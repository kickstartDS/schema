const AjvConstructor = require('ajv');
const fs = require('fs-extra');
const glob = require('fast-glob');
const path = require('path');

// TODO I hate that require / import usage is mixed here -_-
import traverse from 'json-schema-traverse';
import uppercamelcase from 'uppercamelcase';
import { JSONSchema7 } from 'json-schema';
import Ajv from 'ajv/dist/core';

const ajv = new AjvConstructor({
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
});

const addExplicitAnyOfs = (schemaJson: JSONSchema7, schemaAnyOfs: JSONSchema7[]) => {
  traverse(schemaJson, {
    cb: (schema, pointer, rootSchema) => {
      if (schema.items && schema.items.anyOf) {
        const componentPath = rootSchema.$id.split('/');
        const componentType = path.basename(rootSchema.$id).split('.')[0];
        const componentName = uppercamelcase(componentType);

        schema.items.anyOf = schema.items.anyOf.map((anyOf: JSONSchema7) => {
          if (anyOf.$ref)
            return anyOf;

          const schemaName = `http://frontend.ruhmesmeile.com/${componentPath[3]}/${componentPath[4]}/${componentType}/${pointer.split('/').pop()}-${anyOf.title.replace(componentName, '').toLowerCase()}.interface.json`;
          schemaAnyOfs.push({
            $id: schemaName,
            $schema: "http://json-schema.org/draft-07/schema#",
            ...anyOf,
            definitions: schemaJson.definitions
          });
          return { $ref: schemaName };
        });
      }
    }
  });
}

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

interface SchemaReturns {
  allDefinitions: { [key: string]: JSONSchema7 },
  schemaJsons: JSONSchema7[],
  schemaAnyOfs: JSONSchema7[],
  customSchemaJsons: JSONSchema7[],
  ajv: Ajv,
};

export const getSchemas = async (schemaGlob: string, customGlob: string, pageSchema: JSONSchema7): Promise<SchemaReturns> => {
  const schemaPaths = await glob(schemaGlob);

  const allDefinitions: { [key: string]: JSONSchema7 } = {};
    
  const schemaJsons: JSONSchema7[] = await Promise.all(schemaPaths.map(async (schemaPath: string) => addSchemaPath(schemaPath)));
  const schemaAnyOfs: JSONSchema7[] = [];
  const customSchemaJsons: JSONSchema7[] = [];

  schemaJsons.forEach((schemaJson) => {
    const { definitions } = schemaJson;
    for (const definedTypeName in definitions) {
      allDefinitions[definedTypeName] = definitions[definedTypeName] as JSONSchema7;
    }

    addExplicitAnyOfs(schemaJson, schemaAnyOfs);
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
      let newCustomJson = true;

      for (const definedTypeName in definitions) {
        allDefinitions[definedTypeName] = definitions[definedTypeName] as JSONSchema7;
      }

      schemaJsons.forEach((schemaJson, index) => {
        if (path.basename(customJson.$id) === path.basename(schemaJson.$id)) {
          newCustomJson = false;
          schemaJsons[index] = customJson;
        }
      });

      if (newCustomJson) {
        customSchemaJsons.push(customJson);
      }
    });
  }

  ajv.addSchema(pageSchema);
  ajv.validateSchema(pageSchema);

  return Promise.resolve({
    allDefinitions,
    schemaJsons,
    schemaAnyOfs,
    customSchemaJsons,
    ajv,
  });
};
