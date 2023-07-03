import fs from 'fs';
import ejs from 'ejs';
import inquirer from 'inquirer';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';

export default async function initMicroservice() {
    const questions = [
        {
            type: 'input',
            name: 'name',
            message: 'What is the name of the microservice?',
            validate: function(value) {
                var valid = /^[a-z-]+$/.test(value);

                return valid || 'Please enter a valid project name. Only lowercase letters and hyphens are allowed.';
            }
        },
        {
            type: 'list',
            name: 'template',
            message: 'Which template would you like to use?',
            choices: ['NodeJS API', 'Python API', 'Custom'],
            default: 'Custom',
        },
        {
            type: 'list',
            name: 'authenticationType',
            message: 'Select the authentication type:',
            choices: ['Requires Authentication', 'Allows Unauthenticated'],
        }
    ];

    const answers = await inquirer.prompt(questions);

    // Update the `ziti.config.json` file
    const config = JSON.parse(fs.readFileSync('ziti.config.json', 'utf8'));
    config.microservices = config.microservices || {};
    config.microservices[answers.name] = {
        requiresAuth: answers.authenticationType === 'Requires Authentication',
    };
    fs.writeFileSync('./ziti.config.json', JSON.stringify(config, null, 4));

    // Create the microservice's directory
    if (!fs.existsSync(`microservices/${answers.name}`)) {
        fs.mkdirSync(`microservices/${answers.name}`);
    }

    // Create the template
    switch (answers.template) {
        case 'NodeJS API':
            createTemplate(
                'nodejs-api',
                answers.name
            );
            break;
        case 'Python API':
            createTemplate(
                'python-api',
                answers.name
            );
            break;
        case 'Custom':
            createTemplate(
                'custom',
                answers.name
            );
            break;
        default:
            throw new Error('Invalid template');
    }

    console.log('Microservice initialized!');
}

//#region Helper Functions

function createTemplate(templateName, serviceName) {
    const serviceDir = path.join(process.cwd(), 'microservices', serviceName);
    const templateDir = path.join(dirname(fileURLToPath(import.meta.url)), `../templates/${templateName}`);

    // Get all files in the template directory
    const files = fs.readdirSync(templateDir);

    for (const file of files) {
        const templatePath = path.join(templateDir, file);
        const outputPath = path.join(serviceDir, file.replace('.ejs', ''));

        const template = fs.readFileSync(templatePath, 'utf-8');
        const output = ejs.render(template, { serviceName });

        fs.writeFileSync(outputPath, output);
    }
}

//#endregion