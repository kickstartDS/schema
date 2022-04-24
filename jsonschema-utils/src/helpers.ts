const AjvConstructor = require('ajv');
const fs = require('fs-extra');
const glob = require('fast-glob');
const path = require('path');

// TODO I hate that require / import usage is mixed here -_-
import traverse from 'json-schema-traverse';
import uppercamelcase from 'uppercamelcase';
import { JSONSchema7 } from 'json-schema';
import Ajv from 'ajv/dist/core';

export interface SchemaReturns {
  definitions: { [key: string]: JSONSchema7 }
  jsonSchemas: JSONSchema7[]
  kdsSchemas: JSONSchema7[]
  schemaAnyOfs: JSONSchema7[]
};

export const addExplicitAnyOfs = (jsonSchema: JSONSchema7): JSONSchema7[] => {
  const schemaAnyOfs: JSONSchema7[] = [];

  traverse(jsonSchema, {
    cb: (schema, pointer, rootSchema) => {
      if (schema.items && schema.items.anyOf) {
        const componentPath = rootSchema.$id.split('/');
        const componentType = path.basename(rootSchema.$id).split('.')[0];
        const componentName = uppercamelcase(componentType);

        schema.items.anyOf = schema.items.anyOf.map((anyOf: JSONSchema7) => {
          if (anyOf.$ref) return anyOf;

          const schemaName = `http://schema.kickstartds.com/${componentPath[3]}/${componentPath[4]}/${componentType}/${pointer.split('/').pop()}-${anyOf.title.replace(componentName, '').toLowerCase()}.interface.json`;
          schemaAnyOfs.push({
            $id: schemaName,
            $schema: "http://json-schema.org/draft-07/schema#",
            ...anyOf,
            definitions: jsonSchema.definitions
          });
          return { $ref: schemaName };
        });
      }
    }
  });

  return schemaAnyOfs;
}

export const mergeAnyOfEnums = (schema: JSONSchema7, ajv: Ajv): JSONSchema7 => {
  traverse(schema, {
    cb: (subSchema, pointer, rootSchema) => {
      const propertyName = pointer.split('/').pop();

      if (
        subSchema.anyOf &&
        subSchema.anyOf.length === 2 &&
        subSchema.anyOf.every((anyOf: JSONSchema7) => (anyOf.type === 'string' && anyOf.enum) || (anyOf.$ref && anyOf.$ref.includes(`properties/${propertyName}`))) &&
        rootSchema.allOf &&
        rootSchema.allOf.length === 2 &&
        rootSchema.allOf.some((allOf: JSONSchema7) => allOf.properties && (allOf.properties[propertyName] as JSONSchema7)?.anyOf)
      ) {
        subSchema.type = subSchema.anyOf[0].type;
        subSchema.default = subSchema.anyOf[0].default;
        subSchema.enum = subSchema.anyOf.reduce((enumValues: [string], anyOf: JSONSchema7) => {
          const values = anyOf.enum || (anyOf.$ref && (ajv.getSchema(anyOf.$ref).schema as JSONSchema7).enum);
          values.forEach((value) => {
            if (!enumValues.includes(value as string)) enumValues.push(value as string);
          });
          return enumValues;
        }, []);

        if (rootSchema.allOf.some((allOf: JSONSchema7) => allOf.$ref)) {
          delete (ajv.getSchema(rootSchema.allOf.find((allOf: JSONSchema7) => allOf.$ref).$ref).schema as JSONSchema7).properties[propertyName];
        }
        
        delete subSchema.anyOf;
      }
    },
  });

  return schema;
};

export const getSchemaRegistry = (): Ajv => {
  const ajv = new AjvConstructor({
    removeAdditional: true,
    validateSchema: true,
    schemaId: '$id',
    allErrors: true
  });

  const ignoredFormats = ['image', 'video', 'color', 'markdown', 'id', 'date', 'uri', 'email', 'html'];
  ignoredFormats.forEach((ignoredFormat) =>
    ajv.addFormat(ignoredFormat, { validate: () => true })
  );

  ajv.addKeyword({
    keyword: "faker",
    schemaType: "string",
    validate: () => true,
  });

  return ajv;
};

export const addJsonSchema = (jsonSchema: JSONSchema7, ajv: Ajv) => {
  if (!ajv.getSchema(jsonSchema.$id)) ajv.addSchema(jsonSchema);
  return jsonSchema;
};

// TODO eventually get rid of that `type` hack, if possible
export const loadSchemaPath = async (schemaPath: string): Promise<JSONSchema7> =>
  fs.readFile(schemaPath, 'utf-8').then((schema: string) =>
    JSON.parse(schema.replace(/"type": {/g, '"typeProp": {')) as JSONSchema7);

export const getSchemasForGlob = async (schemaGlob: string): Promise<JSONSchema7[]> => 
  glob(schemaGlob).then((schemaPaths: string[]) =>
    Promise.all(schemaPaths.map(async (schemaPath: string) => loadSchemaPath(schemaPath))));

export const processSchemaGlob = async (schemaGlob: string, ajv: Ajv): Promise<SchemaReturns> => 
  processSchemas(await getSchemasForGlob(schemaGlob), ajv);

export const processSchemas = async (jsonSchemas: JSONSchema7[], ajv: Ajv): Promise<SchemaReturns> => {
  // TODO this should go (`pathPrefix` / environment dependent paths)
  const pathPrefix = fs.existsSync('../dist/.gitkeep') ? '../' : ''
  const schemaGlob = `${pathPrefix}node_modules/@kickstartds/*/lib/**/*.(schema|definitions).json`;
  const kdsSchemas = await getSchemasForGlob(schemaGlob);

  const allDefinitions: { [key: string]: JSONSchema7 } = {};
  const schemaAnyOfs: JSONSchema7[] = [];

  [...jsonSchemas, ...kdsSchemas].forEach((jsonSchema) => {
    const { definitions } = jsonSchema;
    for (const definedTypeName in definitions) {
      allDefinitions[definedTypeName] = definitions[definedTypeName] as JSONSchema7;
    }

    addJsonSchema(jsonSchema, ajv);
  });

  [...jsonSchemas, ...kdsSchemas].forEach((jsonSchema) => {
    schemaAnyOfs.push(...addExplicitAnyOfs(mergeAnyOfEnums(jsonSchema, ajv)));
  });
  schemaAnyOfs.forEach((schemaAnyOf) => addJsonSchema(schemaAnyOf, ajv));

  return {
    definitions: allDefinitions,
    jsonSchemas,
    kdsSchemas,
    schemaAnyOfs,
  };
};

export const getLayeredRefId = (refId: string, reffingSchemaId: string, ajv: Ajv): string => {
  if (!refId.includes('schema.kickstartds.com')) return refId;

  const component = path.basename(refId);
  const layeredComponent = Object.keys(ajv.schemas).filter((schemaId) => schemaId.includes(component) && !schemaId.includes('schema.kickstartds.com'))

  return layeredComponent.length > 0 && (reffingSchemaId.includes('schema.kickstartds.com') || (!refId.includes('section.schema.json') && reffingSchemaId.includes('section.schema.json')))
    ? layeredComponent[0]
    : refId;
};

export const getSchemaName = (schemaId: string | undefined): string => {
  return schemaId && schemaId.split('/').pop()?.split('.').shift() || '';
};

export const toArray = (x: JSONSchema7 | JSONSchema7[] | string | string[]): any[]  =>
  x instanceof Array ? x : [x];

export const toSchema = (x: JSONSchema7 | string): JSONSchema7 =>
  x instanceof Object ? x : JSON.parse(x);

export const capitalize = (s: string) => s && s[0].toUpperCase() + s.slice(1);
