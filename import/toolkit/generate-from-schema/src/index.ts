const fs = require('fs-extra');
const util = require('util');
// const chokidar = require('chokidar');
const { printSchema } = require('graphql');
const { camelCase } = require('change-case');

const convertToGraphQL = require('@kickstartds/jsonschema2graphql').convert;
const createConfigGraphQL = require('@kickstartds/jsonschema2graphql').createConfig;
const convertToNetlifyCMS = require('@kickstartds/jsonschema2netlifycms').convert;
const createConfigNetlifyCMS = require('@kickstartds/jsonschema2netlifycms').createConfig;
const convertToTinaCMS = require('@kickstartds/jsonschema2tinacms').convert;
const createConfigTinaCMS = require('@kickstartds/jsonschema2tinacms').createConfig;
// const convertToBuilderIO = require('@kickstartds/jsonschema2builderio').default;
const convertToSanity = require('@kickstartds/jsonschema2sanity').convert;
const createConfigSanity = require('@kickstartds/jsonschema2sanity').createConfig;

// TODO I hate that require / import usage is mixed here -_-
import {
  dump as yamlDump,
  load as yamlLoad
} from 'js-yaml';
import { readFileSync, existsSync } from 'fs-extra';
import Ajv from 'ajv/dist/core';
import {
  processSchemaGlob,
  getSchemaRegistry,
  getUniqueSchemaIds,
  dedupeDeep,
  collectComponentInterfaces,
  getSchemasForIds,
} from '@kickstartds/jsonschema-utils/dist/helpers';
import { traverse } from 'object-traversal';

// TODO handle `default` merging in allOf reducers
// TODO ensure correct `$id` ends up in schemas after allOf reduce
// TODO update to schema 2012
// TODO generate reference docs / JSDoc, etc
// TODO re-add watch modes (and add some for other converters, too):
/**
  const [, , param] = process.argv;

  ...

  if (param === '--watch') {
    chokidar
      .watch(customGlob, { ignoreInitial: true })
      .on('add', convertToGraphQL)
      .on('change', convertToGraphQL)
      .on('add', convertToNetlifyCMS)
      .on('change', convertToNetlifyCMS);
  }
 */

(async () => {
  const pathPrefix = fs.existsSync('../dist/.gitkeep') ? '../' : ''
  const customGlob = `${pathPrefix}node_modules/@kickstartds/design-system/(dist|cms)/**/*.(schema|definitions).json`;

  // get shared ajv instance, pre-process schemas and get full
  // set of unique schemas. precondition for the following conversions
  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv);
  const uniqueSchemaIds = getUniqueSchemaIds(schemaIds);

  // generate `GraphQLType` types and write `GraphQLSchema` to disk
  // uses `uniqueSchemaIds` as input, to get complete set of kickstartDS
  generateGraphQL(uniqueSchemaIds.filter((schemaId) => !schemaId.includes('/cms/page.schema.json')), ajv);

  // generate `NetlifyCmsField` fields and write `NetlifyCmsConfig` to disk
  // uses custom `section.schema.json` to generate a section-based config
  generateNetlifyCMS(
    [
      'http://schema.kickstartds.com/cms/page.schema.json'
    ],
    [
      'http://kickstartds.com/cms/header.schema.json',
      'http://kickstartds.com/cms/footer.schema.json',
    ],
    ajv
  );

  // TODO add comment
  generateSanity(uniqueSchemaIds.filter((schemaId) => !schemaId.includes('/cms/page.schema.json')), ajv);

  // TODO add comment
  generateTinaCMS([ 'http://schema.kickstartds.com/cms/page.schema.json' ], ajv);

  // TODO re-activate (needs to be realigned to refactoring)
  // const builderioInputsConfig = convertToBuilderIO({
  //   jsonSchemas: jsonSchemas,
  //   definitions,
  //   ajv,
  //   configLocation: 'static/.builderio/builder.inputs.json'
  // });
  // fs.writeFile(
  //   `dist/builder.inputs.json`,
  //   builderioInputsConfig,
  // );
})();

export const generateGraphQL = (
  schemaIds: string[],
  ajv: Ajv,
  configPath: string = 'dist/page.graphql',
) => {
  const jsonSchemas = getSchemasForIds(schemaIds, ajv);
  const componentInterfaces = collectComponentInterfaces(jsonSchemas);

  const gqlTypes = convertToGraphQL({
    schemaIds,
    ajv,
    componentInterfaces,
  });

  // TODO make sure this disclaimer actually lands in the resulting file
  const configDisclaimer = '# This file is auto-generated by @kickstartds/jsonschema2graphql\n# Don`t change manually, your changes *will* be lost!\n\n';
  const configString = `${configDisclaimer}${printSchema(createConfigGraphQL(gqlTypes)).replace(/`/g, "'")}`;

  fs.writeFile(
    configPath,
    configString,
  );
}

export const generateNetlifyCMS = (
  schemaIds: string[],
  settingsSchemaIds: string[],
  ajv: Ajv,
  configPath: string = `dist/config.yml`,
) => {
  const configLocation = 'static/admin/config.yml';
  const config = configLocation && existsSync(configLocation) && yamlLoad(readFileSync(configLocation, 'utf-8'));

  const pageFields = convertToNetlifyCMS({
    schemaIds,
    ajv,
  });

  const settingsFields = convertToNetlifyCMS({
    schemaIds: settingsSchemaIds,
    ajv,
  });

  const netlifyConfig = createConfigNetlifyCMS(
    pageFields,
    settingsFields,
    config ? config : undefined,
    'pages',
    'settings',
  );

  const configDisclaimer = '# This file is auto-generated by @kickstartds/jsonschema2netlifycms\n# Don`t change manually, your changes *will* be lost!\n\n';
  const configString = `${configDisclaimer}${yamlDump(netlifyConfig)}`;
  fs.writeFile(
    configPath,
    configString,
  );
}

const functionRegexp = /'(function.*})'/g;
const renderFunctionsToStrings = (object: Record<string, any>): Record<string, any> => {
  traverse(object, ({ key, value, parent }) => {
    if (typeof value === 'function') {
      parent[key] = value.toString();
    }
  }, {
    cycleHandling: false
  });

  return object;
};

export const generateSanity = (
  schemaIds: string[],
  ajv: Ajv,
) => {
  const sanityComponents = convertToSanity({
    schemaIds,
    ajv,
  });
  const configs = createConfigSanity(sanityComponents);

  const configDisclaimer = '// This file is auto-generated by @kickstartds/jsonschema2sanity\n// Don`t change manually, your changes *will* be lost!';
  const configStrings = configs.objects.reduce((map: Record<string, any>, sanityField: any) => {
    const configString = `${configDisclaimer}\n\nexport default ${util.inspect(renderFunctionsToStrings(sanityField), {showHidden: false, compact: false, depth: null})}`
    map[sanityField.name] = configString.replace(functionRegexp, '$1');
    return map;
  }, {});

  if (!fs.existsSync('dist/sanity')){
    fs.mkdirSync('dist/sanity');
    fs.mkdirSync('dist/sanity/documents');
    fs.mkdirSync('dist/sanity/objects');
  }

  const schemaJs = `
import createSchema from 'part:@sanity/base/schema-creator';
${configs.documents.map((document: { name: string }) => `import ${camelCase(document.name)} from './documents/${document.name}.js'`).join('\n')}
${configs.objects.map((object: { name: string }) => `import ${camelCase(object.name)} from './objects/${object.name}.js'`).join('\n')}

import schemaTypes from 'all:part:@sanity/base/schema-type';

export default createSchema({
  name: 'kickstartDS',
  types: schemaTypes.concat([
    ${configs.documents.map((document: { name: string }) => `${camelCase(document.name)},`).join('\n    ')}
    ${configs.objects.map((object: { name: string }) => `${camelCase(object.name)},`).join('\n    ')}
  ]),
});
  `;

  fs.writeFile(
    `dist/sanity/schema.js`,
    `${configDisclaimer}\n${schemaJs}`
  );

  fs.writeFile(
    `dist/sanity/documents/page.js`,
    `${configDisclaimer}\n\nexport default ${util.inspect(renderFunctionsToStrings(configs.documents[0]), {showHidden: false, compact: false, depth: null}).replace(functionRegexp, '$1')}`
  );

  fs.writeFile(
    `dist/sanity/documents/header.js`,
    `${configDisclaimer}\n\nexport default ${util.inspect(renderFunctionsToStrings(configs.documents[1]), {showHidden: false, compact: false, depth: null}).replace(functionRegexp, '$1')}`
  );

  fs.writeFile(
    `dist/sanity/documents/footer.js`,
    `${configDisclaimer}\n\nexport default ${util.inspect(renderFunctionsToStrings(configs.documents[2]), {showHidden: false, compact: false, depth: null}).replace(functionRegexp, '$1')}`
  );

  fs.writeFile(
    `dist/sanity/documents/settings.js`,
    `${configDisclaimer}\n\nexport default ${util.inspect(renderFunctionsToStrings(configs.documents[3]), {showHidden: false, compact: false, depth: null}).replace(functionRegexp, '$1')}`
  );

  fs.writeFile(
    `dist/sanity/documents/production.js`,
    `${configDisclaimer}\n\nexport default ${util.inspect(renderFunctionsToStrings(configs.documents[4]), {showHidden: false, compact: false, depth: null}).replace(functionRegexp, '$1')}`
  );


  Object.keys(configStrings).forEach((configStringKey) => {
    fs.writeFile(
      `dist/sanity/objects/${configStringKey}.js`,
      configStrings[configStringKey],
    );
  });
}

export const generateTinaCMS = (
  schemaIds: string[],
  ajv: Ajv,
  configPath: string = `dist/tina.json`,
) => {
  const configLocation = 'static/.tina/schema.json';
  // TODO fix reading of config, yamlLoad is obviously wrong here... this can't work!
  const config = configLocation && existsSync(configLocation) && yamlLoad(readFileSync(configLocation, 'utf-8'));

  const pageFields = convertToTinaCMS({
    schemaIds,
    ajv,
    schemaPost: dedupeDeep,
  });

  const tinaConfig = createConfigTinaCMS(
    pageFields,
    config ? config : undefined,
    'pages',
  );

  const configString = `${JSON.stringify(tinaConfig, null, 2)}`;
  fs.writeFile(
    configPath,
    configString,
  );
}

export { processSchemaGlob, getSchemaRegistry };
