'use strict';
const CURR_DIR = process.cwd();
const fs = require('fs');
const pluralize = require('pluralize');
const chalk = require('chalk');
const caseChanger = require('case');

module.exports = async function(modulePath, isForce = false) {
    try {
        const modulePathArr = modulePath.split('/');
        const finalModulePath = `${CURR_DIR}/src/app/main`;
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
            
        }
        console.log(chalk.blueBright('Generating Files'));
        // eslint-disable-next-line no-use-before-define
        await createDirectoryContents(templatePath, finalModuleName, moduleDirPath);
        console.log(chalk.blueBright('Module Generation Complete'));
    } catch (error) {
        if(error.code === 'EEXIST') {
            console.error(chalk.redBright('Module already exists.'));
        } else {
            console.error(chalk.redBright(error.message));
        }
    }
};

// eslint-disable-next-line func-style
async function createDirectoryContents(templatePath, moduleName, moduleWritePath) {
    try {
        const filesToCreate = fs.readdirSync(templatePath);
        filesToCreate.forEach((file) => {
            const origFilePath = `${templatePath}/${file}`;

            // get stats about the current file
            const stats = fs.statSync(origFilePath);

            if (stats.isFile()) {
                let contents = fs.readFileSync(origFilePath, 'utf8');
                const PascalCase = `${caseChanger.pascal(moduleName)}Component`;
                // const camelCase = caseChanger.camel(moduleName);
                const kebabCase = caseChanger.kebab(moduleName);
                switch (file) {
                    case 'sample.component.html':
                        // eslint-disable-next-line no-param-reassign
                        file = `${kebabCase}.component.html`;
                        contents = contents.replace(/MODULE_NAME/g, `${moduleName} works!`);
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
