const AjvConstructor = require('ajv');
const fs = require('fs-extra');
const glob = require('fast-glob');
const path = require('path');

// TODO I hate that require / import usage is mixed here -_-
import traverse from 'json-schema-traverse';
import uppercamelcase from 'uppercamelcase';
import { JSONSchema7 } from 'json-schema';
import Ajv from 'ajv/dist/core';
import _ from 'lodash';

export const getSchemaRegistry = (): Ajv => {
  const ajv = new AjvConstructor({
    removeAdditional: true,
    validateSchema: true,
    schemaId: '$id',
    allErrors: true
  });

  // TODO update JSON Schema, clean up ignored formats
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

export const addExplicitAnyOfs = (jsonSchema: JSONSchema7, ajv: Ajv): JSONSchema7[] => {
  const schemaAnyOfs: JSONSchema7[] = [];

  traverse(jsonSchema, {
    cb: (schema, pointer, rootSchema) => {
      if (schema.items && schema.items.anyOf) {
        const componentPath = rootSchema.$id.split('/');
        const componentType = path.basename(rootSchema.$id).split('.')[0];
        const componentName = uppercamelcase(componentType);

        schema.items.anyOf = schema.items.anyOf.map((anyOf: JSONSchema7) => {
          if (anyOf.$ref) return anyOf;

          const schemaName = `http://schema.kickstartds.com/${componentPath[3]}/${componentType}/${pointer.split('/').pop()}-${anyOf.title.replace(componentName, '').toLowerCase()}.interface.json`;
          const schemaAnyOf = {
            $id: schemaName,
            $schema: "http://json-schema.org/draft-07/schema#",
            ...anyOf,
            definitions: jsonSchema.definitions
          };
          schemaAnyOfs.push(schemaAnyOf);
          addJsonSchema(schemaAnyOf, ajv);
          
          return { $ref: schemaName };
        });
      }
    }
  });

  return schemaAnyOfs;
}

export const mergeAnyOfEnums = (schema: JSONSchema7, ajv: Ajv): void => {
  traverse(schema, {
    cb: (subSchema, pointer, rootSchema) => {
      const propertyName = pointer.split('/').pop();

      if (
        subSchema.anyOf &&
        subSchema.anyOf.length === 2 &&
        subSchema.anyOf.every((anyOf: JSONSchema7) => (anyOf.type === 'string' && anyOf.enum) || (anyOf.$ref && anyOf.$ref.includes(`properties/${propertyName}`))) &&
        (
          (
            rootSchema.allOf &&
            rootSchema.allOf.length === 2 &&
            rootSchema.allOf.some((allOf: JSONSchema7) => allOf.properties && (allOf.properties[propertyName] as JSONSchema7)?.anyOf)
          ) || (
            rootSchema.properties &&
            Object.keys(rootSchema.properties).length > 0 &&
            rootSchema.properties[propertyName]
          )
        )
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

        if (rootSchema.allOf && rootSchema.allOf.some((allOf: JSONSchema7) => allOf.$ref)) {
          delete (ajv.getSchema(rootSchema.allOf.find((allOf: JSONSchema7) => allOf.$ref).$ref).schema as JSONSchema7).properties[propertyName];
        }
        
        delete subSchema.anyOf;
      }
    },
  });
};

// this method should potentially be replaced by something "more"
// standard, like: https://github.com/mokkabonna/json-schema-merge-allof
// may result in handling all of those combinations of edge cases
// ourselves, otherwise
export const reduceSchemaAllOf = (schema: JSONSchema7, ajv: Ajv): JSONSchema7 => {
  const allOfs = schema.allOf as JSONSchema7[];

  const reducedSchema = allOfs.reduce((finalSchema: JSONSchema7, allOf: JSONSchema7) => {
    const mergeSchemaAllOf = (allOf: JSONSchema7): JSONSchema7 => {
      if (!_.isUndefined(allOf.$ref)) {
        const reffedSchema = _.cloneDeep(ajv.getSchema(
          allOf.$ref.includes('#/definitions/') && !allOf.$ref.includes('http')
            ? `${schema.$id}${allOf.$ref}`
            : allOf.$ref
        )?.schema as JSONSchema7);

        return _.merge(
          finalSchema,
          reffedSchema.allOf
            ? reduceSchemaAllOf(reffedSchema, ajv)
            : _.merge(finalSchema, reffedSchema)
        );
      } else {
        reduceSchemaAllOfs(allOf, ajv);
        return _.merge(finalSchema, allOf);
      }
    };

    return mergeSchemaAllOf(allOf);
  }, { } as JSONSchema7);

  if (schema.properties)
    reducedSchema.properties = _.merge(reducedSchema.properties, schema.properties);

  mergeAnyOfEnums(reducedSchema, ajv);

  return reducedSchema;
};

export const reduceSchemaAllOfs = (schema: JSONSchema7, ajv: Ajv): void => {
  traverse(schema, {
    cb: (subSchema, pointer, _rootSchema, _parentPointer, parentKeyword, parentSchema) => {
      if (subSchema.allOf) {
        if (parentSchema && parentKeyword) {
          // if those two are equal, we're at the top level of the schema
          pointer.split('/').pop() === parentKeyword
            ? parentSchema[parentKeyword] = reduceSchemaAllOf(subSchema, ajv)
            : parentSchema[parentKeyword][pointer.split('/').pop()] = reduceSchemaAllOf(subSchema, ajv);
        } else {
          schema.properties = reduceSchemaAllOf(subSchema, ajv).properties;
          delete schema.allOf;
        }
      }
    }
  });
};

export const addJsonSchema = (jsonSchema: JSONSchema7, ajv: Ajv) => {
  if (!ajv.getSchema(jsonSchema.$id)) ajv.addSchema(jsonSchema);
  return jsonSchema;
};

export const layerRefs = (jsonSchemas: JSONSchema7[], kdsSchemas: JSONSchema7[]): void => {
  jsonSchemas.forEach((jsonSchema) => {
    kdsSchemas.forEach((kdsSchema) => {
      traverse(kdsSchema, {
        cb: (subSchema) => {
          if (subSchema.$ref && jsonSchema.$id.split('/').pop() === subSchema.$ref.split('/').pop()) {
            subSchema.$ref = jsonSchema.$id;
          }
        }
      });
    });
  });
};

export const addTypeInterfaces = (jsonSchemas: JSONSchema7[]): void => {
  jsonSchemas.forEach((jsonSchema) => {
    jsonSchema.properties = jsonSchema.properties || {};
    jsonSchema.type = jsonSchema.type || 'object';

    if (jsonSchema.properties.type) {
      jsonSchema.properties.typeProp = jsonSchema.properties.type;
    }

    jsonSchema.properties.type = {
      "const": getSchemaName(jsonSchema.$id)
    };
  });
};

export const inlineDefinitions = (jsonSchemas: JSONSchema7[]): void => {
  jsonSchemas.forEach((jsonSchema) => {
    traverse(jsonSchema, {
      cb: (subSchema, pointer, rootSchema, _parentPointer, parentKeyword, parentSchema) => {
        if (subSchema.$ref && subSchema.$ref.includes('#/definitions/')) {
          if (subSchema.$ref.includes('http')) {
            if (parentKeyword === 'properties') {
              parentSchema[parentKeyword][pointer.split('/').pop()] = jsonSchemas.find((jsonSchema) =>
                jsonSchema.$id === subSchema.$ref.split('#').shift()
              ).definitions[pointer.split('/').pop()];
            } else if (parentKeyword === 'allOf') {
              parentSchema.allOf[pointer.split('/').pop()] = jsonSchemas.find((jsonSchema) =>
                jsonSchema.$id === subSchema.$ref.split('#').shift()
              ).definitions[subSchema.$ref.split('/').pop()];
            }
          } else {
            parentSchema[parentKeyword][pointer.split('/').pop()] = rootSchema.definitions[pointer.split('/').pop()];
          }
        }
      }
    });
  });
};

export const loadSchemaPath = async (schemaPath: string): Promise<JSONSchema7> =>
  fs.readFile(schemaPath, 'utf-8').then((schema: string) => JSON.parse(schema) as JSONSchema7);

export const getSchemasForGlob = async (schemaGlob: string): Promise<JSONSchema7[]> => 
  glob(schemaGlob).then((schemaPaths: string[]) =>
    Promise.all(schemaPaths.map(async (schemaPath: string) => loadSchemaPath(schemaPath))));

export const processSchemaGlob = async (schemaGlob: string, ajv: Ajv): Promise<string[]> => 
  processSchemas(await getSchemasForGlob(schemaGlob), ajv);

export const processSchemas = async (jsonSchemas: JSONSchema7[], ajv: Ajv): Promise<string[]> => {
  // TODO this should go (`pathPrefix` / environment dependent paths)
  const pathPrefix = fs.existsSync('../dist/.gitkeep') ? '../' : ''
  // load all the schema files provided by `@kickstartDS` itself
  const schemaGlob = `${pathPrefix}node_modules/@kickstartds/*/lib/**/*.(schema|definitions).json`;
  const kdsSchemas = await getSchemasForGlob(schemaGlob);

  // Processing consists of 5 steps currently, that need to be run in this
  // exact order, because every step builds on the one before it

  // 1. pre-process, before schemas enter `ajv`
  layerRefs(jsonSchemas, kdsSchemas);
  addTypeInterfaces([...jsonSchemas, ...kdsSchemas]);
  inlineDefinitions([...jsonSchemas, ...kdsSchemas]);

  // 2. add all schemas to ajv for the following processing steps
  [...kdsSchemas, ...jsonSchemas].forEach((schema) => {
    addJsonSchema(schema, ajv);
  });

  // 3. "compile" JSON Schema composition keywords (`anyOf`, `allOf`)
  const schemaAnyOfs: JSONSchema7[] = [];
  [...kdsSchemas, ...jsonSchemas].forEach((schema) => {
    reduceSchemaAllOfs(schema, ajv);
    mergeAnyOfEnums(schema, ajv);

    // 3. schema-local `anyOf` parts get split into distinct
    // schemas, with their own unique `$id` for referencing.
    // all generated schemas get added to `ajv` automatically
    schemaAnyOfs.push(...addExplicitAnyOfs(schema, ajv));
  });

  // 4. process new schemas, resulting from adding the distinct
  // `anyOf`s in the step before 
  addTypeInterfaces(schemaAnyOfs);
  schemaAnyOfs.forEach((schemaAnyOf) => {
    reduceSchemaAllOfs(schemaAnyOf, ajv);
  });

  // 5. return list of processed schema `$id`s.
  // Accessing the full schemas works through `ajv`
  return [...jsonSchemas, ...kdsSchemas, ...schemaAnyOfs]
    .map((jsonSchema) => jsonSchema.$id);
};

// TODO deprecated, should go after refactor
export const getLayeredRefId = (refId: string, reffingSchemaId: string, ajv: Ajv): string => {
  if (!refId.includes('schema.kickstartds.com')) return refId;

  // TODO this needs to actually be handled (definitions could theoretically be overwritten, too)
  // should go away anyways, though, with the removing of `getLayeredRefId` (-> helpers.ts pre-processing step)
  if (refId.includes('#/definitions/')) return refId;

  const component = path.basename(refId);
  const layeredComponent = Object.keys(ajv.schemas).filter((schemaId) => schemaId.includes(component) && !schemaId.includes('schema.kickstartds.com'))

  return layeredComponent.length > 0 && (reffingSchemaId.includes('schema.kickstartds.com') || (!refId.includes('section.schema.json') && reffingSchemaId.includes('section.schema.json')))
    ? layeredComponent[0]
    : refId;
};

export const getSchemaName = (schemaId: string | undefined): string => {
  return schemaId && schemaId.split('/').pop()?.split('.').shift() || '';
};

// TODO deprecated, should go after refactor
export const toArray = (x: JSONSchema7 | JSONSchema7[] | string | string[]): any[]  =>
  x instanceof Array ? x : [x];

// TODO deprecated, should go after refactor
export const toSchema = (x: JSONSchema7 | string): JSONSchema7 =>
  x instanceof Object ? x : JSON.parse(x);

export const capitalize = (s: string) => s && s[0].toUpperCase() + s.slice(1);

export const toPascalCase = (text: string): string =>
  text.replace(/(^\w|-\w)/g, clearAndUpper);

export const clearAndUpper = (text: string): string =>
  text.replace(/-/, " ").toUpperCase();