#!/usr/bin/env node
/* eslint-disable no-unused-vars */
/* eslint-disable quotes */
/* eslint-disable func-style */
/* eslint-disable no-irregular-whitespace */
'use strict';
const inquirer = require('inquirer');
const CURR_DIR = process.cwd();
const fs = require('fs');
const childProcess = require('child_process');
const { paramCase } = require('change-case');
const packageInfo = require('./package.json');
const axios = require('axios');
const ora = require('ora');
const chalk = require('chalk');
const ExcelJs = require('exceljs');
const moduleGenerator = require('./src/module-generator');
const text = `
░█████╗░░█████╗░██╗░░░░░███╗░░░███╗  ░█████╗░██████╗░██╗
██╔══██╗██╔══██╗██║░░░░░████╗░████║  ██╔══██╗██╔══██╗██║
██║░░╚═╝███████║██║░░░░░██╔████╔██║  ███████║██████╔╝██║
██║░░██╗██╔══██║██║░░░░░██║╚██╔╝██║  ██╔══██║██╔═══╝░██║
╚█████╔╝██║░░██║███████╗██║░╚═╝░██║  ██║░░██║██║░░░░░██║
░╚════╝░╚═╝░░╚═╝╚══════╝╚═╝░░░░░╚═╝  ╚═╝░░╚═╝╚═╝░░░░░╚═╝`;

const QUESTIONS = [
    {
        name: 'project-name',
        type: 'input',
        message: 'Project name:',
        validate: function(input) {
            const inputSanitized = input.trim();
            const projectDirectoryName = paramCase(inputSanitized);
            if(!(/^([A-Za-z\-_ \d])+$/.test(inputSanitized))) {
                return 'Project name may only include letters, numbers, underscores and space.';
                // eslint-disable-next-line no-use-before-define
            } else if(directoryExistsCheck(projectDirectoryName)) {
                return `Directory already exists with name "${projectDirectoryName}"`;
            }
            return true;
        }
    },
    {
        name: 'mongo-uri',
        type: 'input',
        message: 'MongoDB URI:',
        default: (answers) => `mongodb://localhost:27017/${paramCase(answers[ 'project-name' ])}`,
        // validate: function(input) {
        //     if (/^(mongodb(\+srv)?:(?:\/{2})?)((\w+?):(\w+?)@|:?@?)(\w+?):(\d+)\/(\w+?)$/.test(input)) {
        //         return true;
        //     }
        //     return 'Invalid MongoDB URI';
        // }
    }
];
// eslint-disable-next-line func-style
async function projectGenerator() {
    console.log(chalk.blueBright(text));
    console.log('::: WELCOME TO CALM API :::');
    console.log(`CLI Version: ${packageInfo.version}\n`);
    let spinner;
    try {
        spinner = ora('Checking for new version').start();
        const { data: npmInfo } = await axios.get('https://registry.npmjs.org/calmapi');
        if( npmInfo && npmInfo[ 'dist-tags' ] ) {
            spinner.stop();
            if(npmInfo[ 'dist-tags' ][ 'latest' ] !== packageInfo.version) {
                console.log(chalk.blueBright(`A newer version ${npmInfo[ 'dist-tags' ][ 'latest' ]} is available. Please update by running "npm i -g calmapi"`));
            } else {
                console.log(chalk.blueBright('You are using the latest version of calmapi'));
            }
        }
    } catch (e) {
        spinner.stop();
    }

    const answers = await inquirer.prompt(QUESTIONS);
    const projectName = answers[ 'project-name' ];
    const mongoUri = answers[ 'mongo-uri' ];
    const projectDirectoryName = paramCase(projectName);
    const templatePath = `${__dirname}/resource/project`;

    fs.mkdirSync(`${CURR_DIR}/${projectDirectoryName}`);
    // eslint-disable-next-line no-use-before-define
    createDirectoryContents(templatePath, projectDirectoryName, projectName, mongoUri);
    // eslint-disable-next-line no-use-before-define
    fs.writeFileSync(`${CURR_DIR}/${projectDirectoryName}/calmapi.json`, JSON.stringify(getCalmApiJson(), null, 3), 'utf8');

    console.log(`:: Setting up : ${projectName}.`);
    console.log(':: Installing dependencies...');
    // eslint-disable-next-line no-use-before-define
    await npmInstall(`${CURR_DIR}/${projectDirectoryName}`);
    console.log(':: Setting up git...');
    // eslint-disable-next-line no-use-before-define
    await gitSetup(`${CURR_DIR}/${projectDirectoryName}`);
    console.log(chalk.blueBright(':: Project Setup Complete'));
    console.log('\nWhat next?');
    console.log('\nGo to the project directory by running');
    console.log(chalk.greenBright(`\ncd ${projectDirectoryName}\n`));
    console.log('\nStart the app by running');
    console.log(chalk.greenBright('\nnpm start\n'));
    console.log('\n\nPre Installed Modules\n\n');
    console.log('1. Auth: Register, Login, Password Reset, Profile\n');
    console.log('1. Post: CRUD\n');
    console.log('Edit the .env file located at the root of the project.');
    console.log(chalk.blueBright('...::: Thank you for using CALM API :::...'));
}

// eslint-disable-next-line func-style
function createDirectoryContents(templatePath, newProjectPath, projectName, mongoUri) {
    const filesToCreate = fs.readdirSync(templatePath);
    const skippedFiles = [ '.env', 'package-lock.json' ];

    filesToCreate.forEach(file => {
        const origFilePath = `${templatePath}/${file}`;

        // get stats about the current file
        const stats = fs.statSync(origFilePath);

        if (stats.isFile()) {
            if(skippedFiles.includes(file)) {
                return;
            }
            let contents = fs.readFileSync(origFilePath, 'utf8');
            // Rename
            if (file === '.npmignore') {
                // eslint-disable-next-line no-param-reassign
                file = '.gitignore';
            }
            if(file === 'package.json') {
                contents = contents.replace('"name": "calmapi"', `"name": "${newProjectPath}"`);
                contents = contents.replace('{{CALMAPI_VERSION}}', packageInfo.version);
            }
            if(file === '.env.sample') {
                contents = contents.replace('{{MONGODB_URI}}', mongoUri);
                // eslint-disable-next-line no-param-reassign
                file = '.env';
            }

            if(file === '.gitignore.sample') {
                // eslint-disable-next-line no-param-reassign
                file = '.gitignore';
            }

            if(file === '.eslintrc.json.sample') {
                // eslint-disable-next-line no-param-reassign
                file = '.eslintrc.json';
            }

            const writePath = `${CURR_DIR}/${newProjectPath}/${file}`;
            fs.writeFileSync(writePath, contents, 'utf8');
        } else if (stats.isDirectory()) {
            fs.mkdirSync(`${CURR_DIR}/${newProjectPath}/${file}`);

            // recursive call
            createDirectoryContents(`${templatePath}/${file}`, `${newProjectPath}/${file}`, projectName);
        }
    });


}

// Performs `npm install`
// eslint-disable-next-line func-style
async function npmInstall(where) {
    try {
        childProcess.execSync('npm install --quiet', { cwd: where, env: process.env, stdio: 'pipe' });
        childProcess.execSync('npm ci --quiet', { cwd: where, env: process.env, stdio: 'pipe' });

    } catch (e) {
        console.error(`Error Installing Packages ${ e.stderr}` ) ;
    }
}

// eslint-disable-next-line func-style
async function gitSetup(where) {
    try {
        childProcess.execSync('git init', { cwd: where, env: process.env, stdio: 'pipe' });
        childProcess.execSync('git add .', { cwd: where, env: process.env, stdio: 'pipe' });
        childProcess.execSync('git commit -m "Initial Setup"', { cwd: where, env: process.env, stdio: 'pipe' });
    } catch (e) {
        console.error(`Error Setting up Git ${ e.stderr}` ) ;
    }
}

// eslint-disable-next-line func-style
function directoryExistsCheck(projectDirectoryName) {
    try {
        return fs.existsSync(`${CURR_DIR}/${projectDirectoryName}`);
    } catch (e) {
        console.log(e);
    }
}

// eslint-disable-next-line func-style
function getCalmApiJson() {
    return{
        'name': 'calmapi',
        'version': packageInfo.version
    };
}

async function generateModel(file) {
    try {
        const wb = new ExcelJs.Workbook();
        await wb.xlsx.readFile(file);

        const sheet = wb.worksheets[ 0 ];
        const result = {};
        const inspectionData = {};

        sheet.eachRow((row, rowNumber) => {
            if(rowNumber !== 1) {
                const cellValue = row.getCell(2).value;
                const cell8Value = row.getCell(8).value;
                const cell9Value = row.getCell(9).value;
                const unit = row.getCell(7)?.value;

                if( !unit ) {
                    if (cellValue) {
                        if (cellValue) {
                            if(cell8Value == 'hard') {
                                if(cell9Value) {
                                    result[ cellValue ] = [ null, [ 'Validators.required', `this.rangeValidationService.rangeValidator(${cell9Value})` ] ];
                                } else {
                                    result[ cellValue ] = [ null, [ 'Validators.required' ] ];
                                }
                            } else if(cell8Value == 'soft') {
                                if(cell9Value) {
                                    result[ cellValue ] = [ null, [ `this.rangeValidationService.rangeValidator(${cell9Value})` ] ];
                                } else {
                                    result[ cellValue ] = [ null ];
                                }
                            } else {
                                result[ cellValue ] = [ null ];
                            }
                        }
                    }
                } else if( unit ) {
                    if (cellValue) {
                        if(cell8Value == 'hard') {
                            if(cell9Value) {
                                inspectionData[ cellValue ] = [ null, [ 'Validators.required', `this.rangeValidationService.rangeValidator(${cell9Value})` ] ];
                            } else {
                                inspectionData[ cellValue ] = [ null, [ 'Validators.required' ] ];
                            }
                        } else if(cell8Value == 'soft') {
                            if(cell9Value) {
                                inspectionData[ cellValue ] = [ null, [ `this.rangeValidationService.rangeValidator(${cell9Value})` ] ];
                            } else {
                                inspectionData[ cellValue ] = [ null ];
                            }
                        } else {
                            inspectionData[ cellValue ] = [ null ];
                        }
                    }
                }
            }
        });

        if (Object.keys(inspectionData).length > 0) {
            inspectionData[ "Unit" ] = [ null ];
            result[ 'InspectionData' ] = [ inspectionData ];
        }
        
        return result;
    } catch (e) {
        console.log(e);
    }
}

async function createHTML(result) {
    try {
        let htmlContent = `
                <form class="noonForm" nz-form [formGroup]="MODULE_COMPONENT_FORM">
                    <div nz-row [nzGutter]="16">
                `;

        for(const eachTable in result) {
            htmlContent += `
                <div nz-col class="gutter-row" [nzLg]="24" [nzMd]="24" [nzSm]="24" [nzXs]="24">
                    <nz-card nzTitle="${result[ eachTable ]?.[ 0 ]?.tableName}">
                        <div nz-row [nzGutter]="16">
                `;
            for(const item of result[ eachTable ]) {
                const labelName = item.labelName;

                if (item.formKey.length === 1) {
                    const formControlName = item.formKey[ 0 ];
                    const tagName = item.tagName[ 0 ] || 'input';
                    const tagEnding = tagName === 'input' ? ` />` : `></${tagName}>`;
                    const attributes = item.attributes[ 0 ].flat().join(' ');

                    htmlContent += `
            <div nz-col class="gutter-row noPadding" [nzLg]="12" [nzMd]="24" [nzSm]="24" [nzXs]="24">
                <nz-form-item>
                    <nz-form-label [nzLg]="8" [nzMd]="24" [nzSm]="24" [nzXs]="24">
                        ${labelName}
                    </nz-form-label>
                    <nz-form-control class="halfFormOneIp" [nzLg]="14" [nzMd]="24" [nzSm]="24" [nzXs]="24">
                        <${tagName} formControlName="${formControlName}" ${attributes}${tagEnding}
                    </nz-form-control>
                </nz-form-item>
            </div>
        `;
                } else {
                    const formControlName1 = item.formKey[ 0 ];
                    const formControlName2 = item.formKey[ 1 ];
                    const tagName1 = item.tagName[ 0 ] || 'input';
                    const tagName2 = item.tagName[ 1 ] || 'input';
                    const tagEnding1 = tagName1 === 'input' ? ` />` : `></${tagName1}>`;
                    const tagEnding2 = tagName2 === 'input' ? ` />` : `></${tagName2}>`;
                    const attributes1 = item.attributes[ 0 ].flat().join(' ');
                    const attributes2 = item.attributes[ 1 ].flat().join(' ');

                    htmlContent += `
                    <div nz-col class="gutter-row noPadding" [nzLg]="12" [nzMd]="24" [nzSm]="24" [nzXs]="24">
                        <div nz-col [nzLg]="24" class="halfRow">
                            <div nz-col class="gutter-row noPadding" [nzLg]="14" [nzMd]="24" [nzSm]="24" [nzXs]="24">
                                <nz-form-item>
                                    <nz-form-label [nzLg]="14" [nzMd]="24" [nzSm]="24" [nzXs]="24">
                                        ${labelName}
                                    </nz-form-label>
                                    <nz-form-control [nzLg]="10" [nzMd]="24" [nzSm]="24" [nzXs]="24">
                                        <${tagName1} class="halfRowFirstIp" formControlName="${formControlName1}"
                                            style="width: 100%" ${attributes1}${tagEnding1}
                                    </nz-form-control>
                                </nz-form-item>
                            </div>
                            <div nz-col class="gutter-row onlyLeftPaddingAdj" [nzLg]="10" [nzMd]="24" [nzSm]="24" [nzXs]="24">
                                <nz-form-item>
                                    <nz-form-control [nzLg]="20" [nzMd]="24" [nzSm]="24" [nzXs]="24">
                                        <${tagName2} formControlName="${formControlName2}" style="width: 100%" ${attributes2}${tagEnding2}

                                    </nz-form-control>
                                </nz-form-item>
                            </div>
                        </div>
                    </div>`;
                }

            };
            htmlContent += `
                    </div>
                </nz-card>
            </div>

            <nz-divider></nz-divider> `;
        }

        htmlContent += `
                    </div>
                </form>`;

        return htmlContent;
    } catch (error) {
        console.log(error);
    }
}

async function generatejson(file) {
    try {
        const wb = new ExcelJs.Workbook();
        await wb.xlsx.readFile(file);

        const sheet = wb.worksheets[ 0 ];
        const result = {};

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber !== 1) {

                const col1Value = row.getCell(1).value;
                const col2Value = row.getCell(2).value;
                const col3Value = row.getCell(3).value;
                const col4Value = row.getCell(4).value;
                const col5Value = row.getCell(5).value;
                const col6Value = row.getCell(6).value;
                const col7Value = row.getCell(7).value;
                const col8Value = row.getCell(8).value;
                const col9Value = row.getCell(9).value;

                if (typeof col6Value == 'number' && col6Value > 0) {

                    const tableKey = col5Value;
                    if (!result[ tableKey ]) {
                        result[ tableKey ] = [];
                    }

                    const existingEntry = result[ tableKey ].find(entry => entry.labelName === col1Value);

                    const determineAttributes = (tagNames, labelName, formKey, range) => {
                        return tagNames.map(tag => {
                            switch (tag) {
                                case 'input':
                                    if( !range ) {
                                        return [ 'nz-input', 'type="text"', `placeholder="${labelName}"` ];
                                    }
                                    return [ 'nz-input', 'type="text"', `placeholder="${labelName}"`, 'nz-tooltip', 'nzTooltipPlacement="bottom"', 'nzTooltipColor="#ff4d4f"', `[nzTooltipTrigger]="tooltipText('${formKey}')"`, `[nzTooltipVisible]="tooltipText('${formKey}')"`, `[nzTooltipTitle]="returnRangeTooltipTitle(${range})"` ];
                                case 'nz-date-picker':
                                    return [ 'nzFormat="dd/MM/yyyy"' ];
                                case 'nz-time-picker':
                                    return [ '[nzUse12Hours]="false"', 'nzFormat="HH:mm"' ];
                                case 'nz-select':
                                    return [ 'nzAllowClear', 'nzShowSearch', `nzPlaceHolder="${labelName}"`, 'style="width: 100%"' ];
                                default:
                                    return [];
                            }
                        });
                    };

                    if (existingEntry) {
                        existingEntry.formKey.push(col2Value);
                        existingEntry.tagName.push(col3Value);
                        existingEntry.attributes.push(...determineAttributes([ col3Value ], col1Value, col2Value, col9Value));
                        existingEntry.mandatory.push(col8Value);
                    } else {
                        const entry = {
                            labelName: col1Value,
                            formKey: [ col2Value ],
                            tagName: [ col3Value ],
                            attributes: determineAttributes([ col3Value ], col1Value, col2Value, col9Value),
                            validation: col4Value,
                            tableName: col5Value,
                            tableNum: col6Value,
                            unit: col7Value,
                            mandatory: [ col8Value ]
                        };
                        entry[ tableKey ] = [];
                        result[ tableKey ].push(entry);
                    }
                }
            }
        });

        // const html = createHTML(result);

        return result;
    } catch (error) {
        console.log(error);
    }
}


// eslint-disable-next-line func-style
async function main() {
    try {
        const argumentsArr = process.argv.slice(2);
        console.log('argumentsArr-----', argumentsArr);
        if(!argumentsArr.length) {
            await projectGenerator();
        }else if(argumentsArr.length >= 3 && (argumentsArr[ 0 ] === 'generate' || argumentsArr[ 0 ] === 'g') && (argumentsArr[ 1 ] === 'component' || argumentsArr[ 1 ] === 'c')) {
            // const isRootFile = fs.readdirSync(CURR_DIR).find(file => file === 'calmapi.json');
            // if(!isRootFile) {
            //     throw new Error('Please Run inside a calmapi Project.');
            // }else {
            //     await moduleGenerator(argumentsArr[ 2 ]);
            // }

            const args = (argumentsArr[ 2 ]).split('/');
            const arg2 = args.pop();
            const path = args.join('/');

            if(argumentsArr[ 3 ] && argumentsArr[ 3 ].includes('.xlsx')) {
                const schema = await generateModel(argumentsArr[ 3 ]);
                const htmlContent = await generatejson(argumentsArr[ 3 ]);
                await moduleGenerator(arg2, false, path, schema, htmlContent, argumentsArr[ 3 ]);
            } else {
                await moduleGenerator(arg2, false, path);
            }
            
        }else if(argumentsArr.length === 4 && (argumentsArr[ 0 ] === 'generate' || argumentsArr[ 0 ] === 'g') && (argumentsArr[ 1 ] === 'component' || argumentsArr[ 1 ] === 'c') && argumentsArr[ 3 ] === '--force') {
            const isRootFile = fs.readdirSync(CURR_DIR).find(file => file === 'calmapi.json');
            if(!isRootFile) {
                throw new Error('Please Run inside a calmapi Project.');
            }else {
                await moduleGenerator(argumentsArr[ 2 ], true);
            }
        } else {
            throw new Error('Invalid Command');
        }

    } catch (error) {
        console.log(error.message);
    }
}

main();
