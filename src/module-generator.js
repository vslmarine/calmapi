/* eslint-disable camelcase */
/* eslint-disable no-unused-vars */
'use strict';
const CURR_DIR = process.cwd();
const fs = require('fs');
const pluralize = require('pluralize');
const chalk = require('chalk');
const caseChanger = require('case');
const Handlebars = require( 'handlebars' );
const ExcelJs = require('exceljs');

// const htmlHandlebar = require('../resource/modules/hanglebars/html.handlebars');

module.exports = async function(modulePath, isForce = false, path = null, result = null, htmlContent = null, file = null) {
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
        await createDirectoryContents(templatePath, finalModuleName, moduleDirPath, result, htmlContent, file);
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
async function createOptionsObj(jsonData, file) {

    const optionsObj = {};
    const wb = new ExcelJs.Workbook();
    await wb.xlsx.readFile(file);

    const sheet = wb.worksheets[ 1 ];

    if(jsonData) {
        Object.values(jsonData).forEach(eachObj => {
            eachObj.forEach(item => {
                if(item?.tagName.includes('nz-select')) {
                    item?.formKey.forEach(key => {
                        optionsObj[ key ] = [];
                    });
                }
            });
        });

        sheet.columns.forEach(column => {
            const firstCellValue = column.values[ 1 ];
            if (optionsObj.hasOwnProperty(firstCellValue)) {
                column.values.slice(2).forEach(val => {
                    if (val !== null && val !== undefined) {
                        optionsObj[ firstCellValue ].push({ value: val, label: val });
                    }
                });
            }
        });

        return optionsObj;
    }
    return optionsObj;
};

const softMandatory = function(schema) {
    const softMandatoryArray = [];
    if(schema) {
        for(const eachKey in schema) {
            if(schema[ eachKey ][ 0 ] == null && !(eachKey.toLocaleLowerCase().includes('comment')) ) {
                softMandatoryArray.push(eachKey);
            }
        }
    }

    return softMandatoryArray;
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

Handlebars.registerHelper('eq', (a, b) => {
    if (a === b) {
        return true;
    };
    return false;
    
});

Handlebars.registerHelper('log', (context) => {
    console.log('Handlebars log:', context);
});

Handlebars.registerHelper('tagEnding', (tagName, formKey) => {

    switch (tagName) {
        case 'input':
            return ' />';
        case 'nz-select':
            return `><nz-option *ngFor="let option of optionsObj?.${formKey}" [nzValue]="option.value" [nzLabel]="option.label"></nz-option></${tagName}>`;
        default:
            return `></${tagName}>`;
    }
    // return tagName === 'input' ? ' />' : `></${tagName}>`;
});

Handlebars.registerHelper('joinAttributes', (attributes) => {
    if (Array.isArray(attributes)) {
        return attributes.flat().join(' ');
    }
    return '';
});

// eslint-disable-next-line func-style
async function createDirectoryContents(templatePath, moduleName, moduleWritePath, schema, htmlContent, worksheet) {
    try {
        const filesToCreate = fs.readdirSync(templatePath);

        const { InspectionData, ...restSchema } = schema;
        console.log('__dirname = ', __dirname);

        const htmlFile = fs.readFileSync(`${__dirname}/../resource/modules/handlebars/html.handlebars`, 'utf8');

        filesToCreate.map(async(file) => {
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
                        if(htmlContent) {
                            // console.log('htmlContent = ', htmlContent);
                            const template = Handlebars.compile( htmlFile );
                            contents = template({ html: htmlContent });
                            
                            // console.log('contents = ', contents);
                            contents = contents.replace(/HTML_MODULE/g, contents);
                            contents = contents.replace(/MODULE_COMPONENT_FORM/g, `${camelCase}Form`);
                        }
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
                        const template = Handlebars.compile( contents );
                        contents = template({ data: schema });
                        contents = contents.replace(/APP_MODULE/g, `'app-${moduleName}'`);
                        contents = contents.replace(/MODULE_HTML_COMPONENT/g, `'./${moduleName}.component.html'`);
                        contents = contents.replace(/MODULE_SCSS/g, `['./${moduleName}.component.scss']`);
                        contents = contents.replace(/MODULE_COMPONENT_FORM/g, `${camelCase}Form`);
                        const soft = softMandatory(schema);
                        contents = contents.replace(/MODULE_SOFT_MANDATORY/g, JSON.stringify(soft));
                        try {

                            const object = await createOptionsObj(htmlContent, worksheet);
                            contents = contents.replace(/MODULE_OPTIONS_OBJ/g, JSON.stringify(object).replace(/:\[/g, ':[\n\t\t\t\t').replace(/},/g, '},\n\t\t\t\t').replace(/\],/g, '],\n\t\t\t').replace(/]}/g, ']\n\t\t\t}')).replace(/ = {/g, '= {\n\t\t\t').replace(/],/g, '\n\t\t\t],');

                            if(InspectionData && InspectionData.length > 0) {
                                contents = contents.replace(/SUB_MODULE_SCHEMA/g, JSON.stringify(InspectionData[ 0 ]).replace(/,/g, ',\n          ').replace(/:\[null\]/g, ': [ null ]').replace(/"/g, ''));
                            }
                            contents = contents.replace(/MODULE_SCHEMA/g, modelSchema(restSchema));
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
    } catch (error) {
        console.log('error = ', error);
    }
}
