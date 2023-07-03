import shell from 'shelljs';
import fs from 'fs';

export default function initGCP(config, environments, billingAccountID, region) {
    // Write the selected cloud region to the config file
    config.cloudRegion = region;
    fs.writeFileSync('./ziti.config.json', JSON.stringify(config, null, 4));

    for (const environment of environments) {
        console.log(`Initializing GCP project for ${environment}...`);
        initGCPProject(config, environment, billingAccountID, region);
        console.log(`Finished initializing GCP project for ${environment}!`);
    }
}

async function initGCPProject(config, environment, billingAccountID, region) {
    // Create the new GCP project, if necessary
    let projectID = config?.cloudProjects?.[environment]?.id;
    if (projectID) {
        console.log('A GCP project already exists for this environment. Skipping project creation.');
    } else {
        // Query for the project ID
        let result = shell.exec(`gcloud projects list --filter="name:${config.projectName}-${environment}" --format="value(projectId)"`, { silent: true });
        projectID = result.stdout.trim();

        if (projectID) {
            console.log('A GCP project already exists for this environment. Skipping project creation.');
        } else {
            shell.exec(`gcloud projects create --name=${config.projectName}-${environment} --quiet`);

            result = shell.exec(`gcloud projects list --filter="name:${config.projectName}-${environment}" --format="value(projectId)"`, { silent: true });
            projectID = result.stdout.trim();
        }

        config.cloudProjects = {
            ...(config?.cloudProjects || {}),
            [environment]: {
                id: projectID,
            }
        };
        fs.writeFileSync('./ziti.config.json', JSON.stringify(config, null, 4));
    }

    // Set the created project as the active project
    shell.exec(`gcloud config set project ${projectID}`);

    // Link the billing account to the project
    shell.exec(`gcloud beta billing projects link ${projectID} --billing-account=${billingAccountID}`);

    // Enable the Cloud Run API
    shell.exec(`gcloud services enable run.googleapis.com --project=${projectID}`);

    // Set the Cloud Run location
    shell.exec(`gcloud config set run/region ${region} --project=${projectID}`);

    // Enable the Artifact Registry API
    shell.exec(`gcloud services enable artifactregistry.googleapis.com --project=${projectID}`);

}