import { promises } from 'fs';
import { createHash } from 'node:crypto';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv';
import { default as glob } from 'fast-glob';
import { resolve } from 'import-meta-resolve';
import traverse from 'json-schema-traverse';
import { type JSONSchema } from 'json-schema-typed/draft-07';
import { get } from 'jsonpointer';
import _ from 'lodash';
import { compose } from 'ramda';
import uppercamelcase from 'uppercamelcase';

declare type MyAjv = import('ajv').default;

export function getSchemaRegistry(): MyAjv {
  const ajv = new Ajv.default({
    removeAdditional: true,
    validateSchema: true,
    schemaId: '$id',
    allErrors: true
  });

  // TODO update JSON Schema, clean up ignored formats
  const ignoredFormats = [
    'image',
    'video',
    'color',
    'markdown',
    'id',
    'date',
    'uri',
    'email',
    'html',
    'uuid',
    'date-time'
  ];
  ignoredFormats.forEach((ignoredFormat) => ajv.addFormat(ignoredFormat, { validate: () => true }));

  ajv.addKeyword({
    keyword: 'faker',
    schemaType: 'string',
    validate: () => true
  });

  return ajv;
}

export function addJsonSchema(jsonSchema: JSONSchema.Interface, ajv: MyAjv): JSONSchema.Interface {
  if (!jsonSchema.$id) throw new Error("Can't add a schema without an $id");

  if (!(ajv.schemas[jsonSchema.$id] || ajv.refs[jsonSchema.$id])) {
    ajv.addSchema(jsonSchema);
  }
  return jsonSchema;
}

export function addExplicitAnyOfs(jsonSchema: JSONSchema.Interface, ajv: MyAjv): JSONSchema.Interface[] {
  const schemaAnyOfs: JSONSchema.Interface[] = [];

  traverse(jsonSchema, {
    cb: (schema, pointer, rootSchema) => {
      if (schema.items && schema.items.anyOf) {
        if (!rootSchema.$id)
          throw new Error('Found a root schema without $id, but every schema processed needs an unique $id');

        const componentPath = rootSchema.$id.split('/');
        const componentType = path.basename(rootSchema.$id).split('.')[0];
        const componentName = uppercamelcase(componentType);

        schema.items.anyOf = schema.items.anyOf.map((anyOf: JSONSchema.Interface) => {
          if (anyOf.$ref) return anyOf;
          if (!anyOf.title) throw new Error('Found an anyOf schema without title, which is not supported');

          const schemaName = `http://schema.kickstartds.com/${componentPath[3]}/${componentType}/${pointer
            .split('/')
            .pop()}-${anyOf.title.replace(componentName, '').toLowerCase()}.interface.json`;
          const schemaAnyOf = {
            $id: schemaName,
            $schema: 'http://json-schema.org/draft-07/schema#',
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

export function mergeAnyOfEnums(schema: JSONSchema.Interface, ajv: MyAjv): void {
  traverse(schema, {
    cb: (subSchema, pointer, rootSchema) => {
      const propertyName = pointer.split('/').pop();
      if (!propertyName) return;

      if (
        subSchema.anyOf &&
        subSchema.anyOf.length === 2 &&
        subSchema.anyOf.every(
          (anyOf: JSONSchema.Interface) =>
            (anyOf.type === 'string' && anyOf.enum) ||
            (anyOf.$ref && anyOf.$ref.includes(`properties/${propertyName}`))
        ) &&
        ((rootSchema.allOf &&
          rootSchema.allOf.length === 2 &&
          rootSchema.allOf.some(
            (allOf: JSONSchema.Interface) =>
              allOf.properties && (allOf.properties[propertyName] as JSONSchema.Interface)?.anyOf
          )) ||
          (rootSchema.properties &&
            Object.keys(rootSchema.properties).length > 0 &&
            rootSchema.properties[propertyName]))
      ) {
        subSchema.type = subSchema.anyOf[0].type;
        subSchema.default = subSchema.anyOf[0].default;
        subSchema.enum = subSchema.anyOf.reduce((enumValues: [string], anyOf: JSONSchema.Interface) => {
          const values =
            anyOf.enum || (anyOf.$ref && (ajv.getSchema(anyOf.$ref)?.schema as JSONSchema.Interface).enum);

          if (!values) throw new Error("Couldn't find a $ref in ajv while merging anyOf enums");

          values.forEach((value) => {
            if (!enumValues.includes(value as string)) enumValues.push(value as string);
          });
          return enumValues;
        }, []);

        if (rootSchema.allOf && rootSchema.allOf.some((allOf: JSONSchema.Interface) => allOf.$ref)) {
          const validateFunction = ajv.getSchema(
            rootSchema.allOf.find((allOf: JSONSchema.Interface) => allOf.$ref).$ref
          );

          if (!validateFunction) throw new Error("Couldn't find a referenced schema in Ajv");

          const reffedSchema = validateFunction.schema as JSONSchema.Interface;
          if (!reffedSchema || !reffedSchema.properties) {
            throw new Error('Referenced schema missing properties when merging anyOf enums');
          }
          delete reffedSchema.properties[propertyName];
        }

        delete subSchema.anyOf;
      }
    }
  });
}

export function reduceSchemaAllOfs(schema: JSONSchema.Interface, ajv: MyAjv): void {
  traverse(schema, {
    cb: (subSchema, pointer, __rootSchema, __parentPointer, parentKeyword, parentSchema) => {
      if (subSchema.allOf) {
        if (parentSchema && parentKeyword) {
          const propertyName = pointer.split('/').pop();

          if (!propertyName) throw new Error('Failed to split a propertyName from a pointer');

          if (propertyName === parentKeyword) {
            parentSchema[parentKeyword] = reduceSchemaAllOf(subSchema, ajv);
          } else {
            parentSchema[parentKeyword][propertyName] = reduceSchemaAllOf(subSchema, ajv);
          }
        } else {
          schema.properties = reduceSchemaAllOf(subSchema, ajv).properties;
          delete schema.allOf;
        }
      }
    }
  });
}

export function reduceSchemaAllOf(schema: JSONSchema.Interface, ajv: MyAjv): JSONSchema.Interface {
  const allOfs = schema.allOf as JSONSchema.Interface[];

  const reducedSchema = allOfs.reduce((finalSchema: JSONSchema.Interface, allOf: JSONSchema.Interface) => {
    const mergeSchemaAllOf = (allOf: JSONSchema.Interface): JSONSchema.Interface => {
      if (!_.isUndefined(allOf.$ref)) {
        const reffedSchema = _.cloneDeep(
          ajv.getSchema(
            allOf.$ref.includes('#/definitions/') && !allOf.$ref.includes('http')
              ? `${schema.$id}${allOf.$ref}`
              : allOf.$ref
          )?.schema as JSONSchema.Interface
        );

        return _.merge(
          reffedSchema && reffedSchema.allOf
            ? reduceSchemaAllOf(reffedSchema, ajv)
            : _.merge(reffedSchema, finalSchema),
          finalSchema
        );
      } else {
        reduceSchemaAllOfs(allOf, ajv);
        return _.merge(allOf, finalSchema);
      }
    };

    return mergeSchemaAllOf(allOf);
  }, {} as JSONSchema.Interface);

  if (schema.properties) reducedSchema.properties = _.merge(schema.properties, reducedSchema.properties);

  mergeAnyOfEnums(reducedSchema, ajv);

  return reducedSchema;
}

export function shouldLayer(schemaId: string, targetSchemaId: string): boolean {
  const targetSchemaURL = new URL(targetSchemaId);
  const layeringSchemaURL = new URL(schemaId);

  const targetSchemaURLPathParts = targetSchemaURL.pathname.split('/');
  const layeringSchemaURLPathParts = layeringSchemaURL.pathname.split('/');

  const targetSchemaFileName = targetSchemaURLPathParts.pop();
  const layeringSchemaFileName = layeringSchemaURLPathParts.pop();

  const targetSchemaPathRest = targetSchemaURLPathParts.pop();
  const layeringSchemaPathRest = layeringSchemaURLPathParts.pop();

  const shouldLayer =
    targetSchemaURL.toString() !== `${layeringSchemaURL.origin}${layeringSchemaURL.pathname}` &&
    targetSchemaFileName === layeringSchemaFileName &&
    ((layeringSchemaPathRest && targetSchemaPathRest === layeringSchemaPathRest) || !layeringSchemaPathRest);

  return shouldLayer;
}

export function isLayering(schemaId: string, targetSchemaIds: string[]): boolean {
  return targetSchemaIds.some((targetSchemaId) => shouldLayer(schemaId, targetSchemaId));
}

export function layeredSchemaId(schemaId: string, targetSchemaIds: string[]): string {
  const layeredId = targetSchemaIds.find((targetSchemaId) => shouldLayer(schemaId, targetSchemaId));

  if (!layeredId) throw new Error('Tried getting a layered id, for a schema that is not layering');

  return layeredId;
}

export function layerRefs(jsonSchemas: JSONSchema.Interface[], kdsSchemas: JSONSchema.Interface[]): void {
  jsonSchemas.forEach((jsonSchema) => {
    kdsSchemas.forEach((kdsSchema) => {
      traverse(kdsSchema, {
        cb: (subSchema) => {
          if (!subSchema.$ref || !subSchema.$ref.includes('http')) return;
          if (!jsonSchema.$id) throw new Error('Found a schema without $id, which is unsupported');

          if (shouldLayer(jsonSchema.$id, subSchema.$ref)) {
            subSchema.$ref = jsonSchema.$id;
          }
        }
      });
    });
  });
}

export function addTypeInterfaces(jsonSchemas: JSONSchema.Interface[]): void {
  jsonSchemas.forEach((jsonSchema) => {
    jsonSchema.properties = jsonSchema.properties || {};
    jsonSchema.type = jsonSchema.type || 'object';

    if (jsonSchema.properties.type) {
      jsonSchema.properties.typeProp = jsonSchema.properties.type;
    }

    jsonSchema.properties.type = {
      const: getSchemaName(jsonSchema.$id)
    };
  });
}

export function inlineReferences(jsonSchemas: JSONSchema.Interface[]): void {
  jsonSchemas.forEach((jsonSchema) => {
    traverse(jsonSchema, {
      cb: (subSchema, pointer, rootSchema, __parentPointer, parentKeyword, parentSchema) => {
        if (!parentSchema || !parentKeyword) return;

        const propertyName = pointer.split('/').pop();
        if (!propertyName) throw new Error('Failed to split a propertyName from a pointer');

        if (subSchema.$ref) {
          const schemaPointer = subSchema.$ref.split('#').pop();
          const schemaId = subSchema.$ref.split('#').shift();

          if (schemaPointer.startsWith('/definitions/')) {
            if (schemaId.startsWith('http')) {
              if (parentKeyword === 'properties') {
                const originalSchema = jsonSchemas.find((jsonSchema) => jsonSchema.$id === schemaId);
                if (!originalSchema || !originalSchema.definitions)
                  throw new Error("Couldn't find original schema to pull definitions from");

                parentSchema.properties[propertyName] = get(originalSchema, schemaPointer);
              } else if (parentKeyword === 'allOf') {
                const originalSchema = jsonSchemas.find((jsonSchema) => jsonSchema.$id === schemaId);
                if (!originalSchema || !originalSchema.definitions)
                  throw new Error("Couldn't find original schema to pull definitions from");

                parentSchema.allOf[propertyName] = get(originalSchema, schemaPointer);
              }
            } else {
              parentSchema[parentKeyword][propertyName] = get(rootSchema, schemaPointer);
            }
          } else if (schemaPointer.startsWith('/properties/')) {
            if (parentKeyword === 'properties') {
              const originalSchema = jsonSchemas.find((jsonSchema) => jsonSchema.$id === schemaId);
              if (!originalSchema || !originalSchema.properties)
                throw new Error("Couldn't find original schema to pull properties from");

              parentSchema.properties[propertyName] = get(originalSchema, schemaPointer);
            }
          }
        }
      }
    });
  });
}

export function collectComponentInterfaces(jsonSchemas: JSONSchema.Interface[]): Record<string, string[]> {
  const interfaceMap: Record<string, string[]> = {};

  jsonSchemas.forEach((jsonSchema) => {
    traverse(jsonSchema, {
      cb: (subSchema, pointer) => {
        const propertyName = pointer.split('/').pop();
        if (!propertyName) throw new Error('Failed to split a propertyName from a pointer');

        if (
          subSchema.items &&
          subSchema.items.anyOf &&
          subSchema.items.anyOf.length > 0 &&
          subSchema.items.anyOf.every((anyOf: JSONSchema.Interface) => anyOf.$ref)
        ) {
          const interfaceName = `${uppercamelcase(getSchemaName(jsonSchema.$id))}Component${uppercamelcase(
            propertyName
          )}`;

          subSchema.items.anyOf.forEach((anyOf: JSONSchema.Interface) => {
            if (!anyOf.$ref) throw new Error('Found anyOf without a $ref, which is not supported');

            interfaceMap[anyOf.$ref] = interfaceMap[anyOf.$ref] || [];
            if (!interfaceMap[anyOf.$ref].includes(interfaceName)) {
              interfaceMap[anyOf.$ref].push(interfaceName);
            }
          });
        }
      }
    });
  });

  return interfaceMap;
}

export function collectReferencedSchemaIds(jsonSchemas: JSONSchema.Interface[], ajv: MyAjv): string[] {
  const referencedIds: string[] = [];

  jsonSchemas.forEach((jsonSchema) => {
    traverse(jsonSchema, {
      cb: (subSchema) => {
        if (subSchema.$ref && !referencedIds.includes(subSchema.$ref)) {
          referencedIds.push(subSchema.$ref);

          const validateFunction = ajv.getSchema<JSONSchema.Interface>(subSchema.$ref);
          if (!validateFunction) throw new Error("Couldn't find a referenced schema in Ajv");

          const schema = validateFunction.schema as JSONSchema.Interface;
          if (schema) {
            collectReferencedSchemaIds([schema], ajv).forEach((schemaId) => {
              if (!referencedIds.includes(schemaId)) {
                referencedIds.push(schemaId);
              }
            });
          }
        }
      }
    });
  });

  return referencedIds;
}

export async function loadSchemaPath(schemaPath: string): Promise<JSONSchema.Interface> {
  return promises
    .readFile(schemaPath, 'utf-8')
    .then((schema: string) => JSON.parse(schema) as JSONSchema.Interface);
}

export async function getSchemasForGlob(schemaGlob: string): Promise<JSONSchema.Interface[]> {
  return glob(schemaGlob).then((schemaPaths: string[]) =>
    Promise.all(schemaPaths.map(async (schemaPath: string) => loadSchemaPath(schemaPath)))
  );
}

export async function processSchemaGlob(
  schemaGlob: string,
  ajv: MyAjv,
  typeResolution: boolean = true
): Promise<string[]> {
  return processSchemas(await getSchemasForGlob(schemaGlob), ajv, typeResolution);
}

export async function processSchemaGlobs(
  schemaGlobs: string[],
  ajv: MyAjv,
  typeResolution: boolean = true
): Promise<string[]> {
  return processSchemas(
    await schemaGlobs.reduce(async (schemasPromise, schemaGlob) => {
      const schemas: JSONSchema.Interface[] = await schemasPromise;
      return schemas.concat(await getSchemasForGlob(schemaGlob));
    }, Promise.resolve([] as JSONSchema.Interface[])),
    ajv,
    typeResolution
  );
}

export async function processSchemas(
  jsonSchemas: JSONSchema.Interface[],
  ajv: MyAjv,
  typeResolution: boolean = true
): Promise<string[]> {
  // load all the schema files provided by `@kickstartDS` itself...
  const kdsSchemas = await ['base', 'blog', 'form', 'content'].reduce(
    async (schemaPromises, moduleName: string) => {
      const schemas = await schemaPromises;
      try {
        const packagePath = path.dirname(
          fileURLToPath(resolve(`@kickstartds/${moduleName}/package.json`, import.meta.url))
        );
        const schemaGlob = `${packagePath}/(lib|cms)/**/*.(schema|definitions|interface).json`;
        return schemas.concat(await getSchemasForGlob(schemaGlob));
      } catch (error) {
        return schemas;
      }
    },
    Promise.resolve([] as JSONSchema.Interface[])
  );

  // ... and add page schema, too
  kdsSchemas.push(
    await loadSchemaPath(fileURLToPath(resolve('../resources/cms/page.schema.json', import.meta.url)))
  );

  // Processing consists of 5 steps currently, that need to be run in this
  // exact order, because every step builds on the one before it
  // 1. pre-process, before schemas enter `ajv`
  layerRefs(jsonSchemas, kdsSchemas);
  if (typeResolution) addTypeInterfaces([...jsonSchemas, ...kdsSchemas]);
  inlineReferences([...jsonSchemas, ...kdsSchemas]);

  // 2. add all schemas to ajv for the following processing steps
  [...jsonSchemas, ...kdsSchemas].forEach((schema) => {
    addJsonSchema(schema, ajv);
  });

  // 3. "compile" JSON Schema composition keywords (`anyOf`, `allOf`)
  const schemaAnyOfs: JSONSchema.Interface[] = [];
  [...jsonSchemas, ...kdsSchemas].forEach((schema) => {
    reduceSchemaAllOfs(schema, ajv);
    mergeAnyOfEnums(schema, ajv);

    // 3. schema-local `anyOf` parts get split into distinct
    // schemas, with their own unique `$id` for referencing.
    // all generated schemas get added to `ajv` automatically
    schemaAnyOfs.push(...addExplicitAnyOfs(schema, ajv));
  });

  // 4. process new schemas, resulting from adding the distinct
  // `anyOf`s in the step before
  if (typeResolution) addTypeInterfaces(schemaAnyOfs);
  schemaAnyOfs.forEach((schemaAnyOf) => {
    reduceSchemaAllOfs(schemaAnyOf, ajv);
  });

  // 5. return list of processed schema `$id`s.
  // Accessing the full schemas works through `ajv`
  const collectedSchemaIds = [...jsonSchemas, ...kdsSchemas, ...schemaAnyOfs]
    .filter((jsonSchema) => jsonSchema && jsonSchema.$id)
    .map((jsonSchema) => jsonSchema.$id || '');

  if (!collectedSchemaIds || collectedSchemaIds.length === 0) throw new Error("Couldn't process schemas");

  return collectedSchemaIds;
}

export function getSchemaName(schemaId: string | undefined): string {
  return (schemaId && schemaId.split('/').pop()?.split('.').shift()) || '';
}

export function getSchemaModule(schemaId: string | undefined): string {
  return (schemaId && schemaId.split('/')[3]) || '';
}

export function getSchemaForId(schemaId: string, ajv: MyAjv): JSONSchema.Interface {
  return ajv.getSchema<JSONSchema.Interface>(schemaId)?.schema as JSONSchema.Interface;
}

export function getSchemasForIds(schemaIds: string[], ajv: MyAjv): JSONSchema.Interface[] {
  return schemaIds.map((schemaId) => getSchemaForId(schemaId, ajv));
}

export function getCustomSchemaIds(schemaIds: string[]): string[] {
  return schemaIds.filter((schemaId) => !schemaId.startsWith('http://schema.kickstartds.com/'));
}

export function getUniqueSchemaIds(schemaIds: string[]): string[] {
  const customSchemaIds = getCustomSchemaIds(schemaIds);
  const unlayeredSchemaIds = schemaIds.filter(
    (schemaId) =>
      schemaId.startsWith('http://schema.kickstartds.com/') &&
      !customSchemaIds.some((customSchemaId) => {
        const propertyName = schemaId.split('/').pop();
        if (!propertyName) throw new Error('Failed to split a propertyName from a pointer');

        return customSchemaId.endsWith(propertyName);
      })
  );

  return [...customSchemaIds, ...unlayeredSchemaIds];
}

export function capitalize(s: string): string {
  return s && s[0].toUpperCase() + s.slice(1);
}

export function hashFieldName(fieldName: string, optionalName?: string): string {
  return fieldName.includes('___NODE')
    ? `${fieldName.replace('___NODE', '')}__${createHash('md5')
        .update(fieldName.replace('___NODE', '') + (optionalName || ''))
        .digest('hex')
        .substr(0, 4)}___NODE`
    : `${fieldName}__${createHash('md5')
        .update(fieldName + (optionalName || ''))
        .digest('hex')
        .substr(0, 4)}`;
}

// TODO pretty sure `fieldName === 'type'` shouldn't be hardcoded here
export function dedupe(
  schema: JSONSchema.Interface,
  optionalName?: string
):
  | {
      [key: string]: JSONSchema.Interface;
    }
  | undefined {
  return _.mapKeys<JSONSchema.Interface>(
    schema.properties,
    (__prop: JSONSchema.Interface, fieldName: string) =>
      fieldName.includes('__') || fieldName === 'type' ? fieldName : hashFieldName(fieldName, optionalName)
  );
}

export function dedupeDeep(schema: JSONSchema.Interface): JSONSchema.Interface {
  traverse(schema, {
    cb: (subSchema) => {
      if (subSchema.properties) {
        subSchema.properties = dedupe(subSchema, getSchemaName(schema.$id));
      }
    }
  });

  return schema;
}

export function toPascalCase(text: string): string {
  return text.replace(/(^\w|-\w)/g, clearAndUpper);
}

export function clearAndUpper(text: string): string {
  return text.replace(/-/, ' ').toUpperCase();
}

export function err(msg: string, propName?: string): Error {
  return new Error(`jsonschema-utils: ${propName ? `Couldn't convert property ${propName}. ` : ''}${msg}`);
}

export function safeEnumKey(value: string): string {
  const trim = (s: string): string => s.trim();
  const isNum = (s: string): boolean => /^[0-9]/.test(s);
  const safeNum = (s: string): string => (isNum(s) ? `VALUE_${s}` : s);
  const convertComparators = (s: string): string => {
    switch (s) {
      case '<':
        return 'LT';
      case '<=':
        return 'LTE';
      case '>=':
        return 'GTE';
      case '>':
        return 'GT';
      default:
        return s;
    }
  };
  const sanitize = (s: string): string => s.replace(/[^_a-zA-Z0-9]/g, '_');
  return compose(sanitize, convertComparators, safeNum, trim)(value);
}
