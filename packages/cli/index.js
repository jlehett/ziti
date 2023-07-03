#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import create from './commands/create.js';
import initCloud from './commands/initCloud.js';
import initMicroservice from './commands/initMicroservice.js';
import deployMicroservice from './commands/deployMicroservice.js';
import deleteMicroservice from './commands/deleteMicroservice.js';

yargs(hideBin(process.argv))
    .scriptName('ziti')
    .command('create', 'Create a new project', {}, create)
    .command('initCloud', 'Initialize the cloud environment', {}, initCloud)
    .command('initMicroservice', 'Initialize a microservice using a template', {}, initMicroservice)
    .command('deployMicroservice', 'Deploy the selected microservices to the cloud', {}, deployMicroservice)
    .command('deleteMicroservice', 'Delete the selected microservices from both the cloud and the local environment', {}, deleteMicroservice)
    .demandCommand(1, 'You need to specify a command')
    .help()
    .argv;