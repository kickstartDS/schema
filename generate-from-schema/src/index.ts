const fs = require('fs-extra');

const chokidar = require('chokidar');
const convertToGraphQL = require('@kickstartds/jsonschema2graphql').default;
const convertToNetlifyCMS = require('@kickstartds/jsonschema2netlifycms').default;
const createConfigNetlifyCMS = require('@kickstartds/jsonschema2netlifycms').createConfig;
const convertToTinaCMS = require('@kickstartds/jsonschema2tinacms').default;
const convertToBuilderIO = require('@kickstartds/jsonschema2builderio').default;
const { printSchema } = require('graphql');
import { 
  dump as yamlDump,
  load as yamlLoad
} from 'js-yaml';
import { readFileSync, existsSync } from 'fs-extra';
import { processSchemaGlob, getSchemaRegistry } from '@kickstartds/jsonschema-utils/dist/helpers';

// TODO I hate that require / import usage is mixed here -_-
import { JSONSchema7 } from 'json-schema';

// TODO move this to `kickstartDS` itself, should also not be a duplicate of
// original `section.schema.json` items for components
// additionally this shouldn't hard-code the assumption of `page.schema.json` as $id
// and `components` should not be there, when `sections` already is
const pageSchema: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "http://schema.kickstartds.com/page.schema.json",
  title: "Page",
  description: "Abstracts a page concept into JSON schema",
  type: "object",
  required: ["id", "slug", "layout", "title"],
  properties: {
    id: {
      type: "string",
      title: "ID",
      description: "Identifying uuid for the page",
      format: "uuid"
    },
    slug: {
      type: "string",
      title: "Slug",
      description: "URL slug for the page"
    },
    layout: {
      type: "string",
      title: "Layout",
      description: "Choose a layout for the page",
      enum: ["default", "content", "blog-list", 'blog-detail', 'glossary'],
      default: "default"
    },
    title: {
      type: "string",
      title: "Title",
      description: "Title used for the page"
    },
    description: {
      type: "string",
      title: "Description",
      description: "Description used for the page"
    },
    keywords: {
      type: "string",
      title: "Keywords",
      description: "Keywords used for the page"
    },
    image: {
      type: "string",
      title: "Preview Image",
      description: "Preview image used for the page",
      format: "image"
    },
    cardImage: {
      type: "string",
      title: "Card Preview Image",
      description: "Card preview image (larger, e.g. Twitter) used for the page"
    },
    sections: {
      type: "array",
      title: "Sections",
      description: "Collection of sections (with their contents) to render on the page",
      items: {
        $ref: "http://schema.kickstartds.com/base/section.schema.json"
      }
    },
    updated: {
      type: "string",
      title: "Updated",
      description: "Last update date for the page",
      format: "date-time"
    },
    created: {
      type: "string",
      title: "Created",
      description: "Creation date for the page",
      format: "date-time"
    }
  }
};

(async () => {
  const [, , param] = process.argv;
  const pathPrefix = fs.existsSync('../dist/.gitkeep') ? '../' : ''
  const customGlob = `${pathPrefix}node_modules/**/dist/**/*.(schema|definitions).json`;

  if (param === '--watch') {
    chokidar
      .watch(customGlob, { ignoreInitial: true })
      .on('add', convertToGraphQL)
      .on('change', convertToGraphQL)
      .on('add', convertToNetlifyCMS)
      .on('change', convertToNetlifyCMS);
  } else {
    const ajv = getSchemaRegistry();
    await processSchemaGlob(customGlob, ajv);

    // const gql = convertToGraphQL({
    //   jsonSchemas: [...kdsSchemas, ...jsonSchemas, ...schemaAnyOfs],
    //   definitions,
    //   ajv,
    // });
    // fs.writeFile(
    //   `dist/page.graphql`,
    //   printSchema(gql).replace(/`/g, "'"),
    // );

    const configLocation = 'static/admin/config.yml';
    const config = configLocation && existsSync(configLocation) && yamlLoad(readFileSync(configLocation, 'utf-8'));

    const netlifyCmsFields = convertToNetlifyCMS({
      schemaIds: ['http://kickstartds.com/section.schema.json'],
      ajv,
    });
    const netlifyConfigDisclaimer = '# This file is auto-generated by @kickstartds/jsonschema2netlifycms\n# Don`t change manually, your changes *will* be lost!\n\n'; 
    const netlifyConfigString = `${netlifyConfigDisclaimer}${yamlDump(createConfigNetlifyCMS(netlifyCmsFields, config ? config : undefined, 'pages'))}`;
    fs.writeFile(
      `dist/config.yml`,
      netlifyConfigString,
    );

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
  }
})();

export const processSchemaGlobHelper = processSchemaGlob;
export const getSchemaRegistryHelper = getSchemaRegistry;