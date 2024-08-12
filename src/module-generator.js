/* eslint-disable camelcase */
/* eslint-disable no-unused-vars */
'use strict';
const CURR_DIR = process.cwd();
const fs = require('fs');
const pluralize = require('pluralize');
const chalk = require('chalk');
const caseChanger = require('case');

module.exports = async function(modulePath, isForce = false, path = null, result = null) {
    try {
        const modulePathArr = modulePath.split('/');
        let finalModulePath;
        if(path) {
            finalModulePath = `${CURR_DIR}/src/app${path}`;
        } else {
            finalModulePath = `${CURR_DIR}/src/app/main`;
        }
        let finalModuleName = modulePathArr;
        if(!isForce) {
            finalModuleName = pluralize.singular(modulePathArr.pop());
        }
        const kebabCase = caseChanger.kebab(finalModuleName);
        const moduleDirPath = `${finalModulePath}/${kebabCase}`;
        const templatePath = `${__dirname}/../resource/modules/sample`;

        console.log(chalk.blueBright(`Creating Module: ${finalModuleName}`));
        console.log(chalk.blueBright(`Creating Directory: ${kebabCase}`));
        try {
            fs.mkdirSync(`${moduleDirPath}`);
        } catch (error) {
            console.log(error);
        }
        console.log(chalk.blueBright('Generating Files'));
        // eslint-disable-next-line no-use-before-define
        await createDirectoryContents(templatePath, finalModuleName, moduleDirPath, result);
        console.log(chalk.blueBright('Module Generation Complete'));
    } catch (error) {
        if(error.code === 'EEXIST') {
            console.error(chalk.redBright('Module already exists.'));
        } else {
            console.error(chalk.redBright(error.message));
        }
    }
};


const modelSchema = function(schema) {

    let newSchema;
    if(schema) {
        newSchema = {
            Report_Type: [ null ],
            ...schema
        };
    } else {
        newSchema = {
            Report_Type: [ null ],
        };
    }

    const jsonSchema = JSON.stringify(newSchema).replace(/,/g, ',\n      ').replace(/:\[null\]/g, ': [ null ]').replace(/"/g, '');
    const jsonNewSchema = jsonSchema.slice(1, (jsonSchema.length - 1));
    return jsonNewSchema;
};

// eslint-disable-next-line func-style
async function createDirectoryContents(templatePath, moduleName, moduleWritePath, schema) {
    try {
        const filesToCreate = fs.readdirSync(templatePath);
        filesToCreate.forEach((file) => {
            const origFilePath = `${templatePath}/${file}`;

            // get stats about the current file
            const stats = fs.statSync(origFilePath);

            if (stats.isFile()) {
                let contents = fs.readFileSync(origFilePath, 'utf8');
                const PascalCase = `${caseChanger.pascal(moduleName)}Component`;
                const camelCase = caseChanger.camel(moduleName);
                const kebabCase = caseChanger.kebab(moduleName);

                switch (file) {
                    case 'sample.component.html':
                        // eslint-disable-next-line no-param-reassign
                        file = `${kebabCase}.component.html`;
                        contents = contents.replace(/MODULE_NAME/g, `${moduleName} works!`);
                        contents = contents.replace(/MODULE_COMPONENT_FORM/g, `${camelCase}Form`);
                        break;
                    case 'sample.component.scss':
                        // eslint-disable-next-line no-param-reassign
                        file = `${kebabCase}.component.scss`;
                        break;
                    case 'sample.component.spec.ts':
                        // eslint-disable-next-line no-param-reassign
                        file = `${kebabCase}.component.spec.ts`;
                        contents = contents.replace(/MODULE_COMPONENT/g, PascalCase);
                        contents = contents.replace(/MODULE_NAME/g, `'./${moduleName}.component'`);
                        break;
                    case 'sample.component.ts':
                        // eslint-disable-next-line no-param-reassign
                        file = `${kebabCase}.component.ts`;
                        contents = contents.replace(/APP_MODULE/g, `'app-${moduleName}'`);
                        contents = contents.replace(/MODULE_HTML_COMPONENT/g, `'./${moduleName}.component.html'`);
                        contents = contents.replace(/MODULE_SCSS/g, `['./${moduleName}.component.scss']`);
                        contents = contents.replace(/MODULE_COMPONENT_FORM/g, `${camelCase}Form`);
                        try {
                            
                            contents = contents.replace(/MODULE_SCHEMA/g, modelSchema(schema));
                        } catch (error) {
                            console.log('error = ', error);
                        }
                        contents = contents.replace(/MODULE_COMPONENT/g, PascalCase);
                        break;
                    default:
                        break;
                }
                const writePath = `${moduleWritePath}/${file}`;
                fs.writeFileSync(writePath, contents, 'utf8');
                console.log(chalk.greenBright(writePath));
            }

        });
    } catch (error) {}
}
