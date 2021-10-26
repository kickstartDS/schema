const fs = require('fs-extra');
const glob = require('fast-glob');
const chokidar = require('chokidar');
const { printSchema } = require('graphql');
const convertToGraphQL = require('@kickstartds/jsonschema2graphql').default;
const convertToNetlifyCMS = require('@kickstartds/jsonschema2netlifycms').default;
const Ajv = require('ajv');
const path = require('path');
// TODO I hate that require / import usage is mixed here -_-
import traverse from 'json-schema-traverse';
import uppercamelcase from 'uppercamelcase';
import { JSONSchema7 } from 'json-schema';

const ajv = new Ajv({
  removeAdditional: true,
  validateSchema: true,
  schemaId: '$id',
  allErrors: true
});

const ignoredFormats = ['image', 'video', 'color', 'markdown', 'id', 'date', 'uri', 'email'];
ignoredFormats.forEach((ignoredFormat) =>
  ajv.addFormat(ignoredFormat, { validate: () => true })
);

ajv.addKeyword({
  keyword: "faker",
  schemaType: "string",
  validate: () => true,
})

const pageSchema: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "http://frontend.ruhmesmeile.com/page.schema.json",
  title: "Page",
  description: "Abstracts a page concept into JSON schema",
  type: "object",
  required: ["id", "layout", "title", "slug"],
  properties: {
    id: {
      type: "string",
      title: "Id",
      description: "Id for the page",
      format: "id"
    },
    layout: {
      type: "string",
      title: "Layout",
      description: "Choose a layout for the page",
      default: "default"
    },
    title: {
      type: "string",
      title: "Title",
      description: "Title for the page"
    },
    description: {
      type: "string",
      title: "Description",
      description: "Description for the page"
    },
    keywords: {
      type: "string",
      title: "Keywords",
      description: "Keywords for the page"
    },
    image: {
      type: "string",
      title: "Preview Image",
      description: "Preview image for the page"
    },
    cardImage: {
      type: "string",
      title: "Card Preview Image",
      description: "Card preview image (larger, e.g. Twitter) for the page"
    },
    slug: {
      type: "string",
      title: "Slug",
      description: "URL slug for the page"
    },
    sections: {
      type: "array",
      title: "Sections",
      description: "Collection of sections making up the content of the page",
      items: {
        $ref: "http://frontend.ruhmesmeile.com/base/base/section.schema.json"
      }
    },
    updated: {
      type: "string",
      title: "Updated",
      description: "Last update date for content",
      format: "date-time"
    },
    created: {
      type: "string",
      title: "Created",
      description: "Creation date for content",
      format: "date-time"
    }
  }
};

const addSchemaPath = async (schemaPath: string) => {
  const schema = await fs.readFile(schemaPath, 'utf-8');
  const schemaJson = JSON.parse(schema.replace(/"type": {/g, '"typeProp": {'));

  if (!ajv.getSchema(schemaJson.$id)) ajv.addSchema(schemaJson);
  return schemaJson;
};

const addSchemaObject = (schemaObject: JSONSchema7) => {
  if (!ajv.getSchema(schemaObject.$id)) ajv.addSchema(schemaObject);
  return schemaObject;
};

(async () => {
  const [, , param] = process.argv;
  const pathPrefix = fs.existsSync('../dist/.gitkeep') ? '../' : ''
  const schemaGlob = `${pathPrefix}node_modules/@kickstartds/*/lib/**/*.(schema|definitions).json`;
  const customGlob = `${pathPrefix}node_modules/**/dist/**/*.(schema|definitions).json`;

  if (param === '--watch') {
    chokidar
      .watch(schemaGlob, { ignoreInitial: true })
      .on('add', convertToGraphQL)
      .on('change', convertToGraphQL)
      .on('add', convertToNetlifyCMS)
      .on('change', convertToNetlifyCMS);
  } else {
    const allDefinitions: { [key: string]: JSONSchema7 } = {};
    const schemaPaths = await glob(schemaGlob);
    const schemaJsons: JSONSchema7[] = await Promise.all(schemaPaths.map(async (schemaPath: string) => addSchemaPath(schemaPath)));
    const schemaAnyOfs: JSONSchema7[] = [];

    schemaJsons.forEach((schemaJson) => {
      const { definitions } = schemaJson;
      for (const definedTypeName in definitions) {
        allDefinitions[definedTypeName] = definitions[definedTypeName] as JSONSchema7;
      }

      if (schemaJson.$id.includes('text-media')) {
        traverse(schemaJson, { cb: (schema, pointer, rootSchema) => {
          if (schema.items && schema.items.anyOf && rootSchema.$id.includes('text-media')) {
            const componentName = uppercamelcase(path.basename(rootSchema.$id).split('.')[0]);
            schema.items.anyOf = schema.items.anyOf.map((anyOf: JSONSchema7) => {
              const schemaName = `http://frontend.ruhmesmeile.com/base/molecules/text-media/media-${anyOf.title.replace(componentName, '').toLowerCase()}.interface.json`;
              schemaAnyOfs.push({
                $id: schemaName,
                $schema: "http://json-schema.org/draft-07/schema#",
                ...anyOf,
                definitions: schemaJson.definitions
              })
              return { $ref: schemaName };
            });
          }
        }});
      }
    });

    schemaAnyOfs.forEach((schemaAnyOf) => addSchemaObject(schemaAnyOf));

    const customPaths = await glob(customGlob);
    if (customPaths.length) {
      const customJsons: JSONSchema7[] = await Promise.all(customPaths.map(async (customPath: string) => addSchemaPath(customPath)));  
      const sectionSchema = customJsons.find((customJson) => customJson.$id?.includes('section.schema.json')) as JSONSchema7;

      if (sectionSchema)
        ((pageSchema.properties.sections as JSONSchema7).items as JSONSchema7).$ref = sectionSchema.$id;

      customJsons.forEach((customJson) => {
        const { definitions } = customJson;
        for (const definedTypeName in definitions) {
          allDefinitions[definedTypeName] = definitions[definedTypeName] as JSONSchema7;
        }

        schemaJsons.forEach((schemaJson, index) => {
          if (path.basename(customJson.$id) === path.basename(schemaJson.$id))
            schemaJsons[index] = customJson;
        }); 
      });
    }

    ajv.addSchema(pageSchema);
    ajv.validateSchema(pageSchema);

    const gql = convertToGraphQL({
      jsonSchema: [...schemaJsons, ...schemaAnyOfs],
      definitions: allDefinitions,
      ajv
    });
    fs.writeFile(
      `dist/page.graphql`,
      printSchema(gql).replace(/`/g, "'")
    );

    schemaJsons.push(pageSchema);
    const netlifyAdminConfig = convertToNetlifyCMS({
      jsonSchema: schemaJsons,
      definitions: allDefinitions,
      ajv,
      configLocation: 'static/admin/config.yml'
    });
    fs.writeFile(
      `dist/config.yml`,
      netlifyAdminConfig,
    );
  }
})();
