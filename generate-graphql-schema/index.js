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

// TODO this should work... but it doesn't
/*ajv.addKeyword({
  keyword: 'faker',
  validate: () => true,
  errors: false,
})*/

const addSchema = async (schemaPath) => {
  const schema = await fs.readJSON(schemaPath);
  if (!ajv.getSchema(schema.$id)) ajv.addSchema(schema);
  return schema;
};

(async () => {
  const [, , param] = process.argv;
  const schemaGlob = '../node_modules/@kickstartds/*/lib/**/*.(schema|definitions).json';
  if (param === '--watch') {
    chokidar
      .watch(schemaGlob, { ignoreInitial: true })
      .on('add', convertToGraphQL)
      .on('change', convertToGraphQL)
      .on('add', convertToNetlifyCMS)
      .on('change', convertToNetlifyCMS);
  } else {
    const schemaPaths = await glob(schemaGlob);
    const schemaJsons = await Promise.all(schemaPaths.map(async (schemaPath) => addSchema(schemaPath)));

    const pageSchema = await fs.readJSON('../example/page.schema.json');
    ajv.addSchema(pageSchema);
    ajv.validateSchema(pageSchema);

    const gql = convertToGraphQL({ jsonSchema: schemaJsons });
    fs.writeFile(
      `../dist/page.graphql`,
      printSchema(gql).replace(/`/g, "'")
    );

    const netlifyAdminConfig = convertToNetlifyCMS({ jsonSchema: schemaJsons });
    fs.writeFile(
      `../dist/config.generated.yml`,
      netlifyAdminConfig,
    );
  }
})();
