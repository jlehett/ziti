import fs from 'fs';
import inquirer from 'inquirer';
import path from 'path';
import shell from 'shelljs';
import dotenv from 'dotenv';

export default async function deployMicroservice() {
    // Load the ziti.config.json file
    const zitiConfig = JSON.parse(fs.readFileSync('ziti.config.json', 'utf8'));

    // Get the list of projects
    const projectEnvironments = Object.keys(zitiConfig.cloudProjects);

    // Get the list of microservices
    const serviceDirs = fs.readdirSync('microservices').filter(file => fs.statSync(path.join('microservices', file)).isDirectory());

    // Define the questions for the user and ask them
    const questions = [
        {
            type: 'list',
            name: 'projectEnvironment',
            message: 'Select the project to deploy to:',
            choices: projectEnvironments,
        },
        {
            type: 'checkbox',
            name: 'microservices',
            message: 'Select the microservices to deploy:',
            choices: serviceDirs,
        },
    ];

    const { projectEnvironment, microservices } = await inquirer.prompt(questions);

    // Set the current project
    shell.exec(`gcloud config set project ${zitiConfig.cloudProjects[projectEnvironment].id}`);

    console.log(`Deploying microservices to ${projectEnvironment}...`);

    // Get a list of every microservice currently deployed to Cloud Run for the given environment
    const deployedServices = shell.exec(`gcloud run services list --platform managed --region ${zitiConfig.cloudRegion} --project ${zitiConfig.cloudProjects[projectEnvironment].id}`).stdout;

    // For each microservice, deploy or update it
    for (const microservice of microservices) {
        console.log(`Deploying ${microservice} to ${projectEnvironment}...`);

        // Get the config for the microservice
        const microserviceConfig = zitiConfig.microservices[microservice];

        const envFilePath = path.join(process.cwd(), `.env.${projectEnvironment}`);
        const envConfig = dotenv.parse(fs.readFileSync(envFilePath));
        const filteredEntries = Object.entries(envConfig).filter(([key, value]) => {
            return value && !value.startsWith('#');
        });
        const envVars = filteredEntries.map(([key, value]) => `${key}=${value}`).join(',');

        // Create the Docker repository
        shell.exec(`gcloud artifacts repositories create ${microservice} --repository-format=docker --location=${zitiConfig.cloudRegion} --description="${microservice} Docker repository"`);

        // Authenticate Docker w/ GCP artifact registry
        shell.exec(`gcloud auth configure-docker ${zitiConfig.cloudRegion}-docker.pkg.dev`);

        // Build the Docker image
        shell.exec(`docker build -t ${zitiConfig.cloudRegion}-docker.pkg.dev/${zitiConfig.cloudProjects[projectEnvironment].id}/${microservice}/${microservice} microservices/${microservice}`);

        // Push the Docker image to GCP artifact registry
        shell.exec(`docker push ${zitiConfig.cloudRegion}-docker.pkg.dev/${zitiConfig.cloudProjects[projectEnvironment].id}/${microservice}/${microservice}`);

        // Get the authentication flag based on the microservice's config
        const authFlag = microserviceConfig.requiresAuth ? '--no-allow-unauthenticated' : '--allow-unauthenticated';

        // If the service is already deployed, simply update it; otherwise, create a new service
        if (deployedServices.includes(microservice)) {
            shell.exec(`gcloud run services update ${microservice} --platform managed --region ${zitiConfig.cloudRegion} --project ${zitiConfig.cloudProjects[projectEnvironment].id} --image ${zitiConfig.cloudRegion}-docker.pkg.dev/${zitiConfig.cloudProjects[projectEnvironment].id}/${microservice}/${microservice} --update-env-vars ${envVars}`);
        } else {
            shell.exec(`gcloud run deploy ${microservice} --image ${zitiConfig.cloudRegion}-docker.pkg.dev/${zitiConfig.cloudProjects[projectEnvironment].id}/${microservice}/${microservice} --update-env-vars ${envVars} ${authFlag}`);
        }

        // Map the microservice to the verified domain
        const subdomain = `${projectEnvironment}-${microservice}.${zitiConfig.verifiedDomain}`;
        shell.exec(`gcloud beta run domain-mappings create --service ${microservice} --domain ${subdomain} --force-override`);
    }
}