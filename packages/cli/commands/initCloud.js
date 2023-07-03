import fs from 'fs';
import inquirer from 'inquirer';
import initGCP from '../utils/initGCP.js';
import GCP_REGIONS from '../utils/gcp-regions.js';

const questions = [
    {
        type: 'input',
        name: 'environments',
        message: 'Enter a comma-separated list of environments you would like to create cloud projects for:',
        validate: function(value) {
            var valid = value.split(',').every(function(env) {
                return /^[a-z\-]+$/.test(env.trim());
            });
            return valid || 'Please enter a comma-separated list of environments. Each environment should only contain lowercase letters and hyphens.';
        },
    },
    {
        type: 'input',
        name: 'verifiedDomain',
        message: 'Enter a verified domain for your project:',
        validate: function(value) {
            var valid = /^[a-z0-9\-\.]+$/.test(value);

            return valid || 'Please enter a valid domain. Only lowercase letters, numbers, hyphens, and periods are allowed.';
        }
    }
]

export default function initCloud() {
    inquirer.prompt(questions).then((answers) => {
        const environments = answers.environments.split(',').map(env => env.trim());
        const { verifiedDomain } = answers;

        // Write the verified domain to the `ziti.config.json` file
        const config = JSON.parse(fs.readFileSync('./ziti.config.json', 'utf8'));
        config.verifiedDomain = verifiedDomain;
        fs.writeFileSync('./ziti.config.json', JSON.stringify(config, null, 4));

        // We first want to create separate `.env` files for each environment
        environments.forEach((env) => {
            // Get the name of the env file
            const envFileName = `.env.${env}`;
            // If the file already exists, skip this environment; otherwise, create the .env file
            if (fs.existsSync(envFileName)) {
                return;
            } else {
                fs.writeFileSync(`./.env.${env}`, '# Add environment variables here');
            }
        });

        switch (config?.cloudPlatform) {
            case 'GCP':
                askAdditionalQuestionsForGCP().then((answers) => {
                    const { region, billingAccountID } = answers;
                    initGCP(config, environments, billingAccountID, region);
                });
                break;
            default:
                throw new Error('Invalid cloud platform');
        }
    });
}

//#region Helper Functions

function askAdditionalQuestionsForGCP() {
    const questions = [
        {
            type: 'input',
            name: 'billingAccountID',
            message: 'Enter the ID of the billing account you want to link to the projects:',
        },
        {
            type: 'list',
            name: 'region',
            message: 'Select a region for your services:',
            choices: GCP_REGIONS,
        },
    ];

    return inquirer.prompt(questions);
}

//#endregion
