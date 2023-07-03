#!/usr/bin/env node

import inquirer from 'inquirer';
import shell from 'shelljs';
import fs from 'fs';
import ejs from 'ejs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

export default function create() {
    const questions = [
        {
            type: 'input',
            name: 'projectCodeName',
            message: 'What is the code name of your project? (hyphens, numbers, and lowercase letters only)',
            validate: function(value) {
                var valid = /^[a-z0-9-]+$/.test(value);

                return valid || 'Please enter a valid project code name. Only lowercase letters, numbers, and hyphens are allowed.';
            }
        },
        {
            type: 'input',
            name: 'projectPublicName',
            message: 'What is the public name of your project?',
        },
        {
            type: 'list',
            name: 'cloudProvider',
            message: 'Which cloud provider do you want to use?',
            choices: ['GCP'],
        },
        {
            type: 'list',
            name: 'frontend',
            message: 'Which front-end do you want to use?',
            choices: ['Angular', 'Vue', 'React'],
        },
    ];

    inquirer.prompt(questions).then((answers) => {
        let { projectCodeName, projectPublicName, frontend, cloudProvider } = answers;

        // Initialize the app directory with the chosen front-end
        let frontendType;
        switch (frontend) {
            case 'Angular':
                frontendType = 'angular';
                break;
            case 'Vue':
                frontendType = 'vue';
                break;
            case 'React':
                frontendType = 'react';
                break;
            default:
                throw new Error('Invalid front-end type');
        }

        console.log('Installing Ionic CLI...');
        shell.exec('npm install -g @ionic/cli --silent');
        console.log('Finished installing Ionic CLI!');

        console.log('Creating Ionic app...');

        switch (frontendType) {
            case 'react':
                // We have a special project template for React
                createTemplateProject(projectCodeName, projectPublicName, frontendType);
                shell.cd(projectCodeName);
                shell.mkdir('microservices');
                break;
            case 'angular':
            case 'vue':
                // Create project directory
                shell.mkdir(projectCodeName);
                shell.cd(projectCodeName);

                // Create microservices and app directories
                shell.mkdir('microservices');

                shell.mkdir('temp');
                shell.cd('temp');
                shell.exec(`ionic start ${projectCodeName} blank --type ${frontendType} --no-git --capacitor`);

                shell.cd('..');  // Log the current working directory

                shell.mv(`./temp/${projectCodeName}`, './app');
                shell.rm('-r', './temp');
                break;
            default:
                throw new Error('Invalid front-end type');
        }

        console.log('Finished creating Ionic app!\n\n');

        // Create the ziti.config.json file
        const config = {
            cloudPlatform: cloudProvider,
            projectName: projectCodeName,
        };

        fs.writeFileSync(`./ziti.config.json`, JSON.stringify(config, null, 4));

        // Install dependencies
        shell.cd('app');
        shell.exec('npm install');

        // Depending on the cloud provider, log the appropriate instructions
        switch (cloudProvider) {
            case 'GCP':
                console.log('Please install the Google Cloud SDK and the `firebase-tools` npm package manually to interact with GCP, and then run `ziti init cloud` to initialize your cloud environment.');
                break;
            default:
                throw new Error('Invalid cloud provider');
        }
    });
}

//#region Helper Functions

function createTemplateProject(projectCodeName, projectPublicName, frontendType) {
    let templateName;
    switch (frontendType) {
        case 'react':
            templateName = 'react-project';
            break;
        default:
            throw new Error('Invalid front-end type');
    }

    const templateDir = path.join(dirname(fileURLToPath(import.meta.url)), '../templates', templateName);

    fs.mkdirSync(projectCodeName);

    // Recursively copy the template directory to the project directory
    processDirectory(
        templateDir,
        path.join(process.cwd(), projectCodeName),
        {
            projectCodeName,
            projectPublicName,
        }
    );
}

function processDirectory(source, destination, data) {
    fs.readdirSync(source).forEach((file) => {
        const sourcePath = path.join(source, file);
        const destinationPath = path.join(destination, file);

        if (fs.lstatSync(sourcePath).isDirectory()) {
            // Create directory if it doesn't exist
            if (!fs.existsSync(destinationPath)) {
                fs.mkdirSync(destinationPath);
            }
            // Recurse if the current path is a directory
            processDirectory(sourcePath, destinationPath, data);
        } else {
            if (path.extname(file) === '.ejs') {
                // Render the ejs template and write it to the destination
                const template = fs.readFileSync(sourcePath, 'utf-8');
                const output = ejs.render(template, data);
                fs.writeFileSync(destinationPath.replace('.ejs', ''), output);
            } else {
                // Copy non-ejs file
                fs.copyFileSync(sourcePath, destinationPath);
            }
        }
    });
}

//#endregion