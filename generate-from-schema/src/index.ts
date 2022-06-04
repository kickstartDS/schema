const fs = require('fs-extra');
const chokidar = require('chokidar');
const { printSchema } = require('graphql');

const convertToGraphQL = require('@kickstartds/jsonschema2graphql').convert;
const createConfigGraphQL = require('@kickstartds/jsonschema2graphql').createConfig;
const convertToNetlifyCMS = require('@kickstartds/jsonschema2netlifycms').convert;
const createConfigNetlifyCMS = require('@kickstartds/jsonschema2netlifycms').createConfig;
// const convertToTinaCMS = require('@kickstartds/jsonschema2tinacms').default;
// const convertToBuilderIO = require('@kickstartds/jsonschema2builderio').default;

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
} from '@kickstartds/jsonschema-utils/dist/helpers';

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
  const customGlob = `${pathPrefix}node_modules/**/dist/**/*.(schema|definitions).json`;

  // get shared ajv instance, pre-process schemas and get full
  // set of unique schemas. precondition for the following conversions
  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv);
  const uniqueSchemaIds = getUniqueSchemaIds(schemaIds);

  // generate `GraphQLType` types and write `GraphQLSchema` to disk
  // uses `uniqueSchemaIds` as input, to get complete set of kickstartDS
  generateGraphQL(uniqueSchemaIds, ajv);

  // generate `NetlifyCmsField` fields and write `NetlifyCmsConfig` to disk
  // uses custom `section.schema.json` to generate a section-based config
  generateNetlifyCMS([ 'http://kickstartds.com/section.schema.json' ], ajv);

  /*
  const sanitySchemas = [
    'http://frontend.ruhmesmeile.com/content/organisms/quotes-slider.schema.json',
    'http://frontend.ruhmesmeile.com/base/atoms/link-button.schema.json',
    'http://frontend.ruhmesmeile.com/base/atoms/toggle.definitions.json',
    'http://frontend.ruhmesmeile.com/base/atoms/button.schema.json',
    'http://frontend.ruhmesmeile.com/base/atoms/tag-label.schema.json',
    'http://frontend.ruhmesmeile.com/content/molecules/visual.schema.json',
    'http://frontend.ruhmesmeile.com/content/molecules/quote.schema.json',
    'http://frontend.ruhmesmeile.com/content/molecules/visual-slider.schema.json',
    'http://frontend.ruhmesmeile.com/content/molecules/contact.schema.json',
    'http://frontend.ruhmesmeile.com/content/molecules/storytelling.schema.json',
    'http://frontend.ruhmesmeile.com/content/molecules/collapsible-box.schema.json',
    'http://frontend.ruhmesmeile.com/content/molecules/count-up.schema.json',
    'http://frontend.ruhmesmeile.com/base/molecules/content-box.schema.json',
    'http://frontend.ruhmesmeile.com/base/molecules/headline.schema.json',
    'http://frontend.ruhmesmeile.com/base/molecules/text-media.schema.json',
    'http://frontend.ruhmesmeile.com/base/molecules/teaser-box.schema.json',
    'http://frontend.ruhmesmeile.com/content/molecules/logo-tiles.schema.json',
    'http://frontend.ruhmesmeile.com/base/molecules/teaser-row.schema.json',
  ];

  const headlineSanitySchema = await addSchemaPath(`${pathPrefix}/jsonschema2sanity/src/schemas/headline.sanity.schema.json`);
  ajv.validateSchema(headlineSanitySchema);
  addExplicitAllOfs(headlineSanitySchema);

  const visualSanitySchema = await addSchemaPath(`${pathPrefix}/jsonschema2sanity/src/schemas/visual.sanity.schema.json`);
  ajv.validateSchema(visualSanitySchema);
  addExplicitAllOfs(visualSanitySchema);

  const sanityObjectFields: Record<string, string> = convertToSanity({
    jsonSchema: [headlineSanitySchema, visualSanitySchema],
    // jsonSchema: [...schemaJsons.filter((schemaJson) => sanitySchemas.includes(schemaJson.$id))],
    definitions: allDefinitions,
    ajv,
    configLocation: 'static/admin/config.yml',
    getSchema,
  });

  if (!fs.existsSync('dist/sanity')){
    fs.mkdirSync('dist/sanity');
  }

  for (const key in sanityObjectFields) {
    fs.writeFile(
      `dist/sanity/${key}.js`,
      sanityObjectFields[key],
    );
  };
  */

  // TODO finish the following stuff:
  // TODO remove layering from reducers, should be done as a
  // pre-processing step to reducing... possibly with a traverse(..)

  // TODO re-activate (needs to be realigned to refactoring)
  // const tinacmsAdminConfig = convertToTinaCMS({
  //   jsonSchemas: jsonSchemas,
  //   definitions,
  //   ajv,
  //   configLocation: 'static/.tina/schema.json'
  // });
  // fs.writeFile(
  //   `dist/tina.json`,
  //   tinacmsAdminConfig,
  // );

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
  const gqlTypes = convertToGraphQL({
    schemaIds,
    ajv,
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
  ajv: Ajv,
  configPath: string = `dist/config.yml`,
) => {
  const configLocation = 'static/admin/config.yml';
  const config = configLocation && existsSync(configLocation) && yamlLoad(readFileSync(configLocation, 'utf-8'));

  const netlifyCmsFields = convertToNetlifyCMS({
    schemaIds,
    ajv,
  });
  
  const configDisclaimer = '# This file is auto-generated by @kickstartds/jsonschema2netlifycms\n# Don`t change manually, your changes *will* be lost!\n\n';
  const configString = `${configDisclaimer}${yamlDump(createConfigNetlifyCMS(netlifyCmsFields, config ? config : undefined, 'pages'))}`;

  fs.writeFile(
    configPath,
    configString,
  );
}


export { processSchemaGlob, getSchemaRegistry };