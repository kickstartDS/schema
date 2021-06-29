const fs = require('fs-extra');
const glob = require('fast-glob');
const chokidar = require('chokidar');
const { printSchema } = require('graphql');
const convertToGraphQL = require('@kickstartds/jsonschema2graphql').default;
const convertToNetlifyCMS = require('@kickstartds/jsonschema2netlifycms').default;
const Ajv = require('ajv');

const ajv = new Ajv({
  removeAdditional: true,
  validateSchema: true,
  schemaId: '$id',
  allErrors: true
});

const ignoredFormats = ['image', 'video', 'color', 'markdown', 'id'];
ignoredFormats.forEach((ignoredFormat) =>
  ajv.addFormat(ignoredFormat, { validate: () => true })
);

ajv.addKeyword('faker', {
  type: 'string',
  validate: () => true,
  errors: false,
});

const pageSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "http://frontend.ruhmesmeile.com/page.schema.json",
  title: "Page",
  description: "Abstracts a page concept into JSON schema",
  type: "object",
  required: ["id", "layout"],
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
    sections: {
      type: "array",
      title: "Sections",
      description: "Collection of sections making up the content of the page",
      items: {
        $ref: "http://frontend.ruhmesmeile.com/base/base/section.schema.json"
      }
    }
  }
};

const addSchema = async (schemaPath: string) => {
  const schema = await fs.readJSON(schemaPath);
  if (!ajv.getSchema(schema.$id)) ajv.addSchema(schema);
  return schema;
};

(async () => {
  const [, , param] = process.argv;
  const schemaGlob = `node_modules/@kickstartds/*/lib/**/*.(schema|definitions).json`;
  if (param === '--watch') {
    chokidar
      .watch(schemaGlob, { ignoreInitial: true })
      .on('add', convertToGraphQL)
      .on('change', convertToGraphQL)
      .on('add', convertToNetlifyCMS)
      .on('change', convertToNetlifyCMS);
  } else {
    const schemaPaths = await glob(schemaGlob);
    const schemaJsons = await Promise.all(schemaPaths.map(async (schemaPath: string) => addSchema(schemaPath)));

    ajv.addSchema(pageSchema);
    ajv.validateSchema(pageSchema);

    const gql = convertToGraphQL({ jsonSchema: schemaJsons, ajv });
    fs.writeFile(
      `dist/page.graphql`,
      printSchema(gql).replace(/`/g, "'")
    );

    schemaJsons.push(pageSchema);
    const netlifyAdminConfig = convertToNetlifyCMS({ jsonSchema: schemaJsons, ajv });
    fs.writeFile(
      `dist/config.generated.yml`,
      netlifyAdminConfig,
    );
  }
})();
