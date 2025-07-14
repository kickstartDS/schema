import { promises } from 'fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultObjectForSchema } from '@kickstartds/cambria';
import Ajv from 'ajv';
import Ajv2019 from 'ajv/dist/2019.js';
import { kebabCase, pascalCase } from 'change-case';
import { default as glob } from 'fast-glob';
import { resolve } from 'import-meta-resolve';
import traverse from 'json-schema-traverse';
import { type JSONSchema } from 'json-schema-typed/draft-07';
import { get } from 'jsonpointer';

import { SchemaDirectedGraph, SchemaEdge, SchemaVertex } from './graph.js';

declare type MyAjv = import('ajv').default;
declare type MyAjv2019 = import('ajv/dist/2019.js').default;

const require: NodeRequire = createRequire(import.meta.url);
const draft7MetaSchema: Ajv.AnySchemaObject = require('ajv/dist/refs/json-schema-draft-07.json');

export function getSchemaRegistry({ support2019 = false }: { support2019?: boolean } = {}):
  | MyAjv
  | MyAjv2019 {
  const ajvOptions: Ajv.Options = {
    removeAdditional: true,
    validateSchema: true,
    schemaId: '$id',
    allErrors: true
  };
  const ajv = support2019 ? new Ajv2019.default(ajvOptions) : new Ajv.default(ajvOptions);

  if (support2019) {
    ajv.addMetaSchema(draft7MetaSchema);
  }

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
    'date-time',
    'icon',
    'table'
  ];
  ignoredFormats.forEach((ignoredFormat) => ajv.addFormat(ignoredFormat, { validate: () => true }));

  ajv.addKeyword({
    keyword: 'faker',
    schemaType: 'string',
    validate: () => true
  });
  ajv.addKeyword({
    keyword: 'x-cms-group-name',
    schemaType: 'string',
    validate: () => true
  });
  ajv.addKeyword({
    keyword: 'x-cms-group-title',
    schemaType: 'string',
    validate: () => true
  });
  ajv.addKeyword({
    keyword: 'x-cms-group-icon',
    schemaType: 'string',
    validate: () => true
  });
  ajv.addKeyword({
    keyword: 'x-cms-group-inline',
    schemaType: 'boolean',
    validate: () => true
  });
  ajv.addKeyword({
    keyword: 'x-cms-hidden',
    schemaType: 'boolean',
    validate: () => true
  });
  ajv.addKeyword({
    keyword: 'x-cms-preview',
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
    cb: (schema, __pointer, rootSchema) => {
      if (schema.items && schema.items.anyOf) {
        if (!rootSchema.$id)
          throw new Error('Found a root schema without $id, but every schema processed needs an unique $id');

        const componentPath = rootSchema.$id.split('/');
        const componentType = path.basename(rootSchema.$id).split('.')[0];

        schema.items.anyOf = schema.items.anyOf.map((anyOf: JSONSchema.Interface) => {
          if (anyOf.$ref) return anyOf;
          if (!anyOf.title) throw new Error('Found an anyOf schema without title, which is not supported');

          const schemaName = `http://schema.kickstartds.com/${componentPath[3]}/${componentType}/${kebabCase(
            anyOf.title
          )}.interface.json`;
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

export function reduceSchemaAllOfs(
  schema: JSONSchema.Interface,
  ajv: MyAjv,
  replaceExamples: boolean = false
): void {
  traverse(schema, {
    cb: (subSchema, pointer, __rootSchema, __parentPointer, parentKeyword, parentSchema) => {
      if (subSchema.allOf) {
        if (parentSchema && parentKeyword) {
          const propertyName = pointer.split('/').pop();

          if (!propertyName) throw new Error('Failed to split a propertyName from a pointer');

          if (propertyName === parentKeyword) {
            parentSchema[parentKeyword] = reduceSchemaAllOf(subSchema, ajv, replaceExamples);
          } else {
            parentSchema[parentKeyword][propertyName] = reduceSchemaAllOf(subSchema, ajv, replaceExamples);
          }
        } else {
          schema.properties = reduceSchemaAllOf(subSchema, ajv, replaceExamples).properties;
          delete schema.allOf;
        }
      }
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMerge<T extends Record<string, any>>(
  obj1: T,
  obj2: T,
  replaceExamples: boolean = false
): T {
  const keys = Array.from(new Set([...Object.keys(obj1), ...Object.keys(obj2)]));

  return keys.reduce((acc, key) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val1 = obj1[key] as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val2 = obj2[key] as any;

    if (Array.isArray(val1) && Array.isArray(val2)) {
      acc[key] =
        key === 'examples' && replaceExamples
          ? val2
          : (acc[key] = [...val1, ...val2].filter((value, index, self) => {
              return self.findIndex((v) => v === value) === index;
            }));
    } else if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
      acc[key] = deepMerge(val1, val2, replaceExamples);
    } else if (key in obj2) {
      acc[key] = structuredClone(val2);
    } else {
      acc[key] = structuredClone(val1);
    }

    return acc;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, {} as any) as T;
}

export function reduceSchemaAllOf(
  schema: JSONSchema.Interface,
  ajv: MyAjv,
  replaceExamples: boolean = false
): JSONSchema.Interface {
  const allOfs = schema.allOf as JSONSchema.Interface[];

  const reducedSchema = allOfs.reduce((finalSchema: JSONSchema.Interface, allOf: JSONSchema.Interface) => {
    const mergeSchemaAllOf = (allOf: JSONSchema.Interface): JSONSchema.Interface => {
      if (allOf.allOf) {
        return deepMerge(reduceSchemaAllOf(allOf, ajv, replaceExamples), finalSchema, replaceExamples);
      } else if (allOf.$ref !== undefined) {
        const reffedSchema = structuredClone(
          ajv.getSchema(
            allOf.$ref.includes('#/definitions/') && !allOf.$ref.includes('http')
              ? `${schema.$id}${allOf.$ref}`
              : allOf.$ref
          )?.schema as JSONSchema.Interface
        );

        return deepMerge(
          reffedSchema && reffedSchema.allOf
            ? reduceSchemaAllOf(reffedSchema, ajv, replaceExamples)
            : deepMerge(reffedSchema, finalSchema, replaceExamples),
          finalSchema,
          replaceExamples
        );
      } else {
        reduceSchemaAllOfs(allOf, ajv, replaceExamples);
        return deepMerge(allOf, finalSchema, replaceExamples);
      }
    };

    return mergeSchemaAllOf(allOf);
  }, {} as JSONSchema.Interface);

  if (schema.properties)
    reducedSchema.properties = deepMerge(schema.properties, reducedSchema.properties || {});

  mergeAnyOfEnums(reducedSchema, ajv);

  return reducedSchema;
}

export function getSchemaFileName(schemaId: string): string {
  const schemaURL = new URL(schemaId);
  const schemaURLPathParts = schemaURL.pathname.split('/');
  const schemaFileName = schemaURLPathParts.pop();

  if (!schemaFileName) throw new Error(`Failed to get schema file name from schema URL for ${schemaId}`);
  return schemaFileName;
}

export function shouldLayer(schemaId: string, targetSchemaId: string, inSchemaId?: string): boolean {
  // TODO inSchemaId needed? dont replace refpointers? add layerOrder
  const targetSchemaURL = new URL(targetSchemaId);
  const layeringSchemaURL = new URL(schemaId);

  const targetSchemaFileName = getSchemaFileName(targetSchemaId);
  const layeringSchemaFileName = getSchemaFileName(schemaId);
  const inSchemaFileName = inSchemaId ? getSchemaFileName(inSchemaId) : '';

  const shouldLayer =
    targetSchemaURL.host !== layeringSchemaURL.host &&
    targetSchemaFileName === layeringSchemaFileName &&
    inSchemaFileName !== targetSchemaFileName;

  // console.log(
  //   'inSchemaFileName path',
  //   inSchemaFileName !== targetSchemaFileName,
  //   inSchemaFileName,
  //   targetSchemaFileName
  // );

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

export function layerRefs(jsonSchemas: JSONSchema.Interface[], schemasToLayer: JSONSchema.Interface[]): void {
  console.log(
    'layering refs',
    jsonSchemas.length,
    schemasToLayer.length,
    jsonSchemas.map((schema) => schema.$id)
  );
  jsonSchemas.forEach((jsonSchema) => {
    schemasToLayer.forEach((schemaToLayer) => {
      traverse(schemaToLayer, {
        cb: (subSchema) => {
          if (!subSchema.$ref || !subSchema.$ref.includes('http')) return;
          if (!jsonSchema.$id) throw new Error('Found a schema without $id, which is unsupported');

          if (shouldLayer(jsonSchema.$id, subSchema.$ref, schemaToLayer.$id)) {
            const hash = new URL(subSchema.$ref).hash;

            console.log(
              '-------------------\n',
              'layering in',
              schemaToLayer.$id,
              '\nlayering:',
              jsonSchema.$id,
              'to previous:',
              subSchema.$ref,
              '\nsetting to',
              `${jsonSchema.$id}${hash}`
            );

            subSchema.$ref = `${jsonSchema.$id}${hash}`;
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

export function inlineReferences(jsonSchemas: JSONSchema.Interface[], typeResolution: boolean = false): void {
  jsonSchemas.forEach((jsonSchema) => {
    traverse(jsonSchema, {
      cb: (subSchema, pointer, rootSchema, __parentPointer, parentKeyword, parentSchema) => {
        if (!parentSchema || !parentKeyword) return;

        const propertyName =
          pointer.split('/').pop() === 'type' && typeResolution ? 'typeProp' : pointer.split('/').pop();
        if (!propertyName) throw new Error('Failed to split a propertyName from a pointer');

        if (subSchema.$ref) {
          const schemaPointer =
            subSchema.$ref.split('#').pop().endsWith('/type') && typeResolution
              ? subSchema.$ref.split('#').pop().replace('/type', '/typeProp')
              : subSchema.$ref.split('#').pop();
          const schemaId = subSchema.$ref.split('#').shift();

          if (schemaPointer.startsWith('/definitions/')) {
            if (schemaId.startsWith('http')) {
              if (parentKeyword === 'properties') {
                const originalSchema = jsonSchemas.find((jsonSchema) => jsonSchema.$id === schemaId);
                if (!originalSchema || !originalSchema.definitions)
                  throw new Error("Couldn't find original schema to pull definitions from");

                const test = get(originalSchema, schemaPointer);
                if (!test) console.log('empty pointer', schemaPointer);
                parentSchema.properties[propertyName] = test;
              } else if (parentKeyword === 'allOf') {
                const originalSchema = jsonSchemas.find((jsonSchema) => jsonSchema.$id === schemaId);
                if (!originalSchema || !originalSchema.definitions)
                  throw new Error("Couldn't find original schema to pull definitions from");

                const test = get(originalSchema, schemaPointer);
                if (!test) console.log('empty pointer', schemaPointer);
                parentSchema.allOf[propertyName] = test;
              }
            } else {
              const test = get(rootSchema, schemaPointer);
              if (!test) console.log('empty pointer', schemaPointer);
              parentSchema[parentKeyword][propertyName] = get(rootSchema, schemaPointer);
            }
          } else if (schemaPointer.startsWith('/properties/')) {
            if (parentKeyword === 'properties') {
              const originalSchema = jsonSchemas.find((jsonSchema) => jsonSchema.$id === schemaId);
              if (!originalSchema || !originalSchema.properties)
                throw new Error("Couldn't find original schema to pull properties from");

              const test = get(originalSchema, schemaPointer);
              if (!test) console.log('empty pointer', schemaPointer);
              parentSchema.properties[propertyName] = test;
            } else if (parentKeyword === 'allOf') {
              const originalSchema = jsonSchemas.find((jsonSchema) => jsonSchema.$id === schemaId);
              if (!originalSchema || !originalSchema.properties)
                throw new Error("Couldn't find original schema to pull properties from");

              const index = Number(pointer.split('/').pop());
              const test = get(originalSchema, schemaPointer);
              if (!test) console.log('empty pointer', schemaPointer);
              parentSchema.allOf[index] = test;
            }
          }
        }
      }
    });
  });
}

export function processAdditionalProperties(
  jsonSchemas: JSONSchema.Interface[],
  additionalProperties: IProcessingOptions['additionalProperties']
): void {
  jsonSchemas.forEach((jsonSchema) => {
    traverse(jsonSchema, {
      cb: (subSchema) => {
        if (subSchema.type && subSchema.type === 'object') {
          if (additionalProperties === 'forceFalse') subSchema.additionalProperties = false;
          else if (subSchema.additionalProperties === undefined && additionalProperties === 'fillFalse')
            subSchema.additionalProperties = false;
          else if (subSchema.additionalProperties === undefined && additionalProperties === 'fillTrue')
            subSchema.additionalProperties = true;
        }
      }
    });
  });
}

export function hideCmsFields(jsonSchemas: JSONSchema.Interface[]): void {
  jsonSchemas.forEach((jsonSchema) => {
    traverse(jsonSchema, {
      cb: (subSchema, pointer, __rootSchema, __parentPointer, parentKeyword, parentSchema) => {
        const propName = pointer.split('/').pop();
        if (
          propName &&
          parentSchema &&
          parentKeyword &&
          parentSchema[parentKeyword][propName] &&
          subSchema['x-cms-hidden'] === true
        )
          delete parentSchema[parentKeyword][propName];
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
          const interfaceName = `${pascalCase(getSchemaName(jsonSchema.$id))}Component${pascalCase(
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

export function getSchemaGraph(jsonSchemas: JSONSchema.Interface[]): SchemaDirectedGraph {
  const graph = new SchemaDirectedGraph();

  for (const jsonSchema of jsonSchemas) {
    if (!jsonSchema.$id) throw new Error('Schema without $id while getting schema graph!');
    if (!graph.hasVertex(jsonSchema.$id)) {
      graph.addVertex(new SchemaVertex(jsonSchema.$id, jsonSchema));
    }
    traverse(jsonSchema, {
      cb: (subSchema, jsonPtr) => {
        if (subSchema.$ref && subSchema.$ref.includes('http')) {
          if (!jsonSchema.$id) throw new Error('Schema without id in graph generation');
          const reffedSchema = jsonSchemas.find(
            (jsonSchema) => jsonSchema.$id === subSchema.$ref.replace(/#.*$/g, '')
          );
          if (!reffedSchema || !reffedSchema.$id)
            throw new Error("Couldn't find a reffed json in json graph generation");
          if (!graph.hasEdge(jsonSchema.$id, reffedSchema.$id)) {
            if (!graph.hasVertex(reffedSchema.$id)) {
              graph.addVertex(new SchemaVertex(reffedSchema.$id, reffedSchema));
            }

            graph.addEdge(
              new SchemaEdge(jsonSchema.$id, reffedSchema.$id, [
                {
                  refOrigin: jsonPtr,
                  refTarget: subSchema.$ref
                }
              ])
            );
          } else {
            const edge = graph.getEdge(jsonSchema.$id, reffedSchema.$id) as SchemaEdge;
            edge.data!.push({
              refOrigin: jsonPtr,
              refTarget: subSchema.$ref
            });
          }
        }
      }
    });
  }

  return graph;
}

export function getSortedSchemas(graph: SchemaDirectedGraph): JSONSchema.Interface[] {
  const sortedVertices: SchemaVertex[] = graph.topologicalSort('vertex') as SchemaVertex[];
  if (!sortedVertices) throw new Error('Failed to get sorted vertices');
  return sortedVertices.map((vertex) => vertex.data || {}).reverse();
}

export function getLayerName(schemaId: string): string {
  return schemaId.includes('schema.kickstartds.com') ? 'kickstartds' : schemaId.split('//')[1].split('.')[0];
}

export function layerSchemas(sortedSchemas: JSONSchema.Interface[], layerOrder: string[]): void {
  const graph = new SchemaDirectedGraph();
  for (const jsonSchema of sortedSchemas) {
    if (!jsonSchema.$id) throw new Error('Schema without $id while layering schemas');
    const layerName = getLayerName(jsonSchema.$id);
    if (!layerName)
      throw new Error(`Failed to get layer name from schema $id ${jsonSchema.$id} for layering`);
    if (!layerOrder.includes(layerName))
      throw new Error(`Layer name ${layerName} not included in layer order: ${layerOrder}`);

    if (!graph.hasVertex(jsonSchema.$id)) graph.addVertex(new SchemaVertex(jsonSchema.$id, jsonSchema));

    if (jsonSchema.allOf && jsonSchema.allOf.length > 1) {
      const ref = jsonSchema.allOf.filter((entry) => {
        if (entry === true || entry === false) return false;
        if (entry.$ref && entry.$ref.includes('http')) return true;
        return false;
      });
      if (ref.length !== 1) {
        throw new Error(
          `Found a schema with multiple $refs in root allOf, which is not supported: ${jsonSchema.$id}`
        );
      }
      const reffedSchema = sortedSchemas.find(
        (schema) => ref[0] !== true && ref[0] !== false && schema.$id === ref[0].$ref
      );
      if (!reffedSchema || !reffedSchema.$id)
        throw new Error("Couldn't find a reffed json in json allOf graph generation");
      if (!graph.hasEdge(jsonSchema.$id, reffedSchema.$id)) {
        if (getSchemaName(jsonSchema.$id) !== getSchemaName(reffedSchema.$id)) continue;
        if (!graph.hasVertex(reffedSchema.$id)) {
          graph.addVertex(new SchemaVertex(reffedSchema.$id, reffedSchema));
        }
        graph.addEdge(
          new SchemaEdge(jsonSchema.$id, reffedSchema.$id, [
            {
              refOrigin: jsonSchema.$id,
              refTarget: reffedSchema.$id
            }
          ])
        );
      }
    }
  }
  const topLayerBySchemaIds: Record<string, JSONSchema.Interface> = {};

  function findMostDistantParent(schemaId: string): JSONSchema.Interface | undefined {
    if (graph.inDegreeOf(schemaId) === 0) return undefined;

    const incomingEdges = graph.incomingEdgesOf(schemaId);
    const parentSchema = graph.getEdgeSrc(incomingEdges[0]);

    if (parentSchema && parentSchema.value && parentSchema.value.$id) {
      const distantParent = findMostDistantParent(parentSchema.value.$id);
      return distantParent || parentSchema.value;
    }
    return undefined;
  }

  for (const jsonSchema of sortedSchemas) {
    if (!jsonSchema.$id) throw new Error('Schema without $id while layering schemas');

    const mostDistantParent = findMostDistantParent(jsonSchema.$id);
    if (mostDistantParent) {
      topLayerBySchemaIds[jsonSchema.$id] = mostDistantParent;
    }
  }

  const topLayerSchemas: JSONSchema.Interface[] = [];
  const checkedSchemas: Set<string> = new Set();

  for (const jsonSchema of sortedSchemas) {
    if (!jsonSchema.$id) throw new Error('Schema without $id while layering schemas');

    const layerName = getLayerName(jsonSchema.$id);
    if (!layerName)
      throw new Error(`Failed to get layer name from schema $id ${jsonSchema.$id} for layering`);
    if (!layerOrder.includes(layerName))
      throw new Error(`Layer name ${layerName} not included in layer order: ${layerOrder}`);

    const schemaFileName = getSchemaFileName(jsonSchema.$id);
    if (checkedSchemas.has(schemaFileName)) continue;

    const topLayerSchema = sortedSchemas.reduce<JSONSchema.Interface>((acc, schema) => {
      if (!acc.$id) throw new Error('Schema without $id while layering schemas');
      if (!schema.$id) throw new Error('Schema without $id while layering schemas');
      if (!schema.$id.includes(schemaFileName)) return acc;

      const currentTopLayer = getLayerName(acc.$id);
      const schemaLayer = getLayerName(schema.$id);
      if (!layerOrder.includes(schemaLayer))
        throw new Error(`Layer name ${schemaLayer} not included in layer order: ${layerOrder}`);
      if (layerOrder.indexOf(schemaLayer) >= layerOrder.indexOf(currentTopLayer)) return acc;

      return schema;
    }, jsonSchema);

    if (topLayerSchema) topLayerSchemas.push(topLayerSchema);

    checkedSchemas.add(schemaFileName);
  }

  layerRefs(topLayerSchemas, sortedSchemas);

  // const schemasByLayer = sortedSchemas.reduce<Record<string, JSONSchema.Interface[]>>((acc, jsonSchema) => {
  //   const layerName = jsonSchema.$id?.includes('schema.kickstartds.com')
  //     ? 'kickstartds'
  //     : jsonSchema.$id?.split('//')[1].split('.')[0];
  //   if (!layerName)
  //     throw new Error(`Failed to get layer name from schema $id ${jsonSchema.$id} for layering`);
  //   if (!layerOrder.includes(layerName))
  //     throw new Error(`Layer name ${layerName} not included in layer order: ${layerOrder}`);

  //   if (!acc[layerName]) acc[layerName] = [];
  //   acc[layerName].push(jsonSchema);

  //   return acc;
  // }, {});

  // for (const layer of layerOrder) {
  //   if (layerOrder.indexOf(layer) === layerOrder.length - 1) continue;
  //   if (!schemasByLayer[layer] || schemasByLayer[layer].length < 1) continue;

  //   for (const deeperLayer of layerOrder.slice(layerOrder.indexOf(layer) + 1).reverse()) {
  //     layerRefs(
  //       schemasByLayer[layer],
  //       schemasByLayer[deeperLayer].filter(
  //         (schema) => !schemasByLayer[layer].some((s) => s.$id === schema.$id)
  //       )
  //     );
  //   }
  // }
}

export interface IProcessingOptions {
  typeResolution: boolean;
  modules: string[];
  additionalProperties: 'keep' | 'fillTrue' | 'fillFalse' | 'forceFalse';
  loadPageSchema: boolean;
  mergeAllOf: boolean;
  mergeAnyOf: boolean;
  layerRefs: boolean;
  inlineReferences: boolean;
  addExplicitAnyOfs: boolean;
  replaceExamples: boolean;
  hideCmsFields: boolean;
  layerOrder: string[];
}

export const defaultProcessingOptions: IProcessingOptions = {
  typeResolution: true,
  modules: ['base', 'blog', 'form', 'content'],
  additionalProperties: 'forceFalse',
  loadPageSchema: true,
  mergeAllOf: true,
  mergeAnyOf: true,
  layerRefs: true,
  inlineReferences: true,
  addExplicitAnyOfs: true,
  replaceExamples: true,
  hideCmsFields: false,
  layerOrder: ['cms', 'schema', 'kickstartds']
};

export async function processSchemaGlob(
  schemaGlob: string,
  ajv: MyAjv,
  options?: Partial<IProcessingOptions>
): Promise<string[]> {
  return processSchemas(await getSchemasForGlob(schemaGlob), ajv, options);
}

export async function processSchemaGlobs(
  schemaGlobs: string[],
  ajv: MyAjv,
  options?: Partial<IProcessingOptions>
): Promise<string[]> {
  return processSchemas(
    await schemaGlobs.reduce(async (schemasPromise, schemaGlob) => {
      const schemas: JSONSchema.Interface[] = await schemasPromise;
      return schemas.concat(await getSchemasForGlob(schemaGlob));
    }, Promise.resolve([] as JSONSchema.Interface[])),
    ajv,
    options
  );
}

export async function processSchemas(
  jsonSchemas: JSONSchema.Interface[],
  ajv: MyAjv,
  options?: Partial<IProcessingOptions>
): Promise<string[]> {
  const {
    modules,
    typeResolution,
    additionalProperties,
    loadPageSchema: shouldLoadPageSchema,
    mergeAllOf: shouldMergeAllOf,
    mergeAnyOf: shouldMergeAnyOf,
    layerRefs: shouldLayerRefs,
    inlineReferences: shouldInlineReferences,
    addExplicitAnyOfs: shouldAddExlicitAnyOfs,
    replaceExamples: shouldReplaceExamples,
    hideCmsFields: shouldHideCmsFields,
    layerOrder
  } = { ...defaultProcessingOptions, ...options };
  // Load all the schema files provided by `@kickstartDS` itself...
  const kdsSchemas =
    modules && modules.length > 0
      ? await modules.reduce(async (schemaPromises, moduleName: string) => {
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
        }, Promise.resolve([] as JSONSchema.Interface[]))
      : [];

  // ... and add page schema, too
  if (shouldLoadPageSchema)
    kdsSchemas.push(
      await loadSchemaPath(fileURLToPath(resolve('../resources/cms/page.schema.json', import.meta.url)))
    );

  const allSchemas = [...jsonSchemas, ...kdsSchemas].filter(
    (value: JSONSchema.Interface, index, self) => self.findIndex((v) => v.$id === value.$id) === index
  );
  if (shouldLayerRefs) layerSchemas(allSchemas, layerOrder);
  const sortedSchemas = getSortedSchemas(getSchemaGraph(allSchemas));

  // Processing consists of 5 steps currently, that need to be run in this
  // exact order, because every step builds on the one before it
  // 1. pre-process, before schemas enter `ajv`
  if (typeResolution) addTypeInterfaces(sortedSchemas);
  if (shouldInlineReferences) inlineReferences(sortedSchemas, typeResolution);
  if (additionalProperties && additionalProperties !== 'keep')
    processAdditionalProperties(sortedSchemas, additionalProperties);

  // 2. add all schemas to ajv for the following processing steps
  sortedSchemas.forEach((schema) => {
    addJsonSchema(schema, ajv);
  });

  // 3. "compile" JSON Schema composition keywords (`anyOf`, `allOf`)
  const schemaAnyOfs: JSONSchema.Interface[] = [];
  sortedSchemas.forEach((schema) => {
    if (shouldMergeAllOf) reduceSchemaAllOfs(schema, ajv, shouldReplaceExamples);
    if (shouldMergeAnyOf) mergeAnyOfEnums(schema, ajv);

    // 3. schema-local `anyOf` parts get split into distinct
    // schemas, with their own unique `$id` for referencing.
    // all generated schemas get added to `ajv` automatically
    if (shouldAddExlicitAnyOfs) schemaAnyOfs.push(...addExplicitAnyOfs(schema, ajv));
  });

  // 4. process new schemas, resulting from adding the distinct
  // `anyOf`s in the step before, hide CMS fields marked as hidden
  if (typeResolution) addTypeInterfaces(schemaAnyOfs);
  if (shouldAddExlicitAnyOfs && shouldMergeAllOf)
    schemaAnyOfs.forEach((schemaAnyOf) => {
      reduceSchemaAllOfs(schemaAnyOf, ajv, shouldReplaceExamples);
    });
  if (shouldHideCmsFields) hideCmsFields(sortedSchemas);
  if (shouldHideCmsFields) hideCmsFields(schemaAnyOfs);

  // 5. return list of processed schema `$id`s.
  // Accessing the full schemas works through `ajv`
  const collectedSchemaIds = [...sortedSchemas, ...schemaAnyOfs]
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

export function getSchemaDefaults(schemaId: string, ajv: MyAjv): Record<string, unknown> {
  const schema = ajv.getSchema<JSONSchema.Object>(schemaId)?.schema as JSONSchema.Object;
  if (!schema) throw new Error(`Couldn't find schema for id ${schemaId}`);

  return defaultObjectForSchema(schema);
}

export function capitalize(s: string): string {
  return s && s[0].toUpperCase() + s.slice(1);
}

export function hashFieldName(fieldName: string, optionalName?: string): string {
  return fieldName.includes('___NODE')
    ? `${fieldName.replace('___NODE', '')}__${createHash('md5')
        .update(fieldName.replace('___NODE', '') + (optionalName || ''))
        .digest('hex')
        .slice(0, 4)}___NODE`
    : `${fieldName}__${createHash('md5')
        .update(fieldName + (optionalName || ''))
        .digest('hex')
        .slice(0, 4)}`;
}

export function clearHashing(
  schema: JSONSchema.Interface,
  optionalName?: string
):
  | {
      [key: string]: JSONSchema.Interface;
    }
  | undefined {
  return schema.properties
    ? Object.entries(schema.properties).reduce((a, [fieldName, value]) => {
        // TODO think again about `fieldName === 'type'`, maybe relation to typeResolutionField?
        a[
          fieldName.includes('__') || fieldName === 'type'
            ? fieldName
            : hashFieldName(fieldName, optionalName)
        ] = value as JSONSchema.Interface;
        return a;
      }, {} as { [key: string]: JSONSchema.Interface })
    : undefined;
}

export function clearHashingDeep(schema: JSONSchema.Interface): JSONSchema.Interface {
  traverse(schema, {
    cb: (subSchema) => {
      if (subSchema.properties) {
        subSchema.properties = clearHashing(subSchema, getSchemaName(schema.$id));
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

export function err(message: string, ...objects: unknown[]): Error {
  if (objects && objects.length) console.error(`jsonschema-utils: debug context`, ...objects);
  return new Error(`jsonschema-utils: ${message}`);
}

export function compose<T>(fn1: (a: T) => T, ...fns: Array<(a: T) => T>): (value: T) => T {
  return fns.reduce((prevFn, nextFn) => (value) => prevFn(nextFn(value)), fn1);
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
  return compose<string>(sanitize, convertComparators, safeNum, trim)(value);
}
