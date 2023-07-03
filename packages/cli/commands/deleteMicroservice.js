import fs from 'fs';
import inquirer from 'inquirer';
import path from 'path';
import shell from 'shelljs';

export default async function deleteMicroservice() {
    // Load the ziti.config.json file
    const zitiConfig = JSON.parse(fs.readFileSync('ziti.config.json', 'utf8'));

    // Get the list of projects
    const projectEnvironments = Object.keys(zitiConfig.cloudProjects);

    // Get the list of microservices
    const serviceDirs = fs.readdirSync('microservices').filter(file => fs.statSync(path.join('microservices', file)).isDirectory());

    // Define the questions for the user and ask them
    const questions = [
        {
            type: 'checkbox',
            name: 'microservices',
            message: 'Select the microservices to delete:',
            choices: serviceDirs,
        },
    ];

    const { microservices } = await inquirer.prompt(questions);

    // Delete each microservice
    for (const microservice of microservices) {

        // Delete the microservice from all cloud environments
        for (const projectEnvironment of projectEnvironments) {

            const projectID = zitiConfig.cloudProjects[projectEnvironment].id;

            // Set the current project
            shell.exec(`gcloud config set project ${zitiConfig.cloudProjects[projectEnvironment].id}`);

            // Delete the domain mapping
            shell.exec(`gcloud beta run domain-mappings delete --domain=${projectEnvironment}-${microservice}.${zitiConfig.verifiedDomain} --quiet`);

            // Delete the service from Cloud Run
            shell.exec(`gcloud run services delete ${microservice} --quiet`);
        }

        // Delete the local microservice directory
        deleteDirectory(path.join(process.cwd(), `microservices/${microservice}`));

        // Delete the microservice information from the ziti config file
        delete zitiConfig.microservices[microservice];
    }

    // Update the ziti config file
    fs.writeFileSync('ziti.config.json', JSON.stringify(zitiConfig, null, 4));
}

//#region Helper Functions

function deleteDirectory(directory) {
    if (fs.existsSync(directory)) {
        fs.readdirSync(directory).forEach((file) => {
            const currentPath = path.join(directory, file);
            if (fs.lstatSync(currentPath).isDirectory()) {
                // Recurse if the current path is a directory
                deleteDirectory(currentPath);
            } else {
                // Delete file
                fs.unlinkSync(currentPath);
            }
        });

        // Delete directory
        fs.rmdirSync(directory);
    }
}

//#endregion