import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLType,
  GraphQLUnionType,
  GraphQLInterfaceType,
} from 'graphql';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import _ from 'lodash';
import uppercamelcase from 'uppercamelcase';
import { GraphQLTypeMap } from './@types';
import { getTypeName } from './getTypeName';
import { graphqlSafeEnumKey } from './graphqlSafeEnumKey';
import { err } from './helpers';
import Ajv from 'ajv';
import { createHash } from "crypto";
import * as path from 'path';

const typeResolutionField = 'type';

/** Maps basic JSON schema types to basic GraphQL types */
const BASIC_TYPE_MAPPING = {
  string: GraphQLString,
  integer: GraphQLInt,
  number: GraphQLFloat,
  boolean: GraphQLBoolean,
};

const contentComponentInterface = new GraphQLInterfaceType({
  name: 'ContentComponent',
  fields: {
    type: { type: GraphQLString }
  },
});

const gatsbyFileInterface = new GraphQLInterfaceType({
  name: 'File',
  fields: {}
});

const internalTypeDefinition: JSONSchema7Definition = {
  "type": "string",
  "title": "Internal type",
  "description": "Internal type for interface resolution",
};

let allDefinitions: JSONSchema7[];
const allDefinitionTypes = {};
// TODO these should be (cli) options
const shouldDedupe = true;
const gatsbyImages = true;

export function cleanFieldName(name: string): string {
  return name.replace(/__.*/i, '');
};

export function cleanObjectKeys(obj: Record<string, any>) {
  const cleanedObject = {};

  Object.keys(obj).forEach((property) => {
    if (property !== typeResolutionField) {
      if (Array.isArray(obj[property])) {
        if (obj[property].length > 0) {
          cleanedObject[cleanFieldName(property)] = obj[property].map((item: Record<string, any>) => {
            return cleanObjectKeys(item);
          });
        }
      } else if (typeof obj[property] === 'object') {
        if (obj[property] !== null) {
          cleanedObject[cleanFieldName(property)] =
            cleanObjectKeys(obj[property]);
        }
      } else if (obj[property]) {
        if (obj[property] !== null) {
          // TODO re-simplify this... only needed because of inconsistent handling of `-` vs `_` in schema enum values
          // TODO also `graphqlSafeEnumKey.ts` is destructive right now, as in: you can't deterministically convert
          // values back to their original form, once they are made safe. This is why different properties (like `ratio`
          // or `pattern`) need to be handled explicitly here. To reconstruct the needed format. As properties can be
          // customized from a project-level (e.g. `pattern` already is an individualization for `kickstartDS/design-system`)
          // we can't have custom handling per property here. At least in the long run!
          if (cleanFieldName(property) === 'variant') {
            cleanedObject[cleanFieldName(property)] = obj[property].replace('_', '-');
          } else if (cleanFieldName(property) === 'ratio') {
            cleanedObject[cleanFieldName(property)] = obj[property].replace('VALUE_', '').replace('_', ':');
          } else if (cleanFieldName(property) === 'pattern') {
            cleanedObject[cleanFieldName(property)] = obj[property].replace('VALUE_', '');
          } else {
            cleanedObject[cleanFieldName(property)] = obj[property];
          }
        }
      }
    }
  });

  return cleanedObject;
};

export function hashFieldName(fieldName: string, optionalName?: string): string {
  return fieldName.includes('___NODE')
    ? `${fieldName.replace('___NODE', '')}__${createHash('md5').update(fieldName.replace('___NODE', '') + (optionalName || '')).digest('hex').substr(0,4)}___NODE`
    : `${fieldName}__${createHash('md5').update(fieldName + (optionalName || '')).digest('hex').substr(0,4)}`;
};

export function hashObjectKeys(obj: Record<string, any>, outerComponent: string) {
  const hashedObj = {};

  if (!obj) return obj;

  Object.keys(obj).forEach((property) => {
    if (property === typeResolutionField) {
      hashedObj[typeResolutionField] = obj[typeResolutionField];
    } else {
      if (Array.isArray(obj[property])) {
        hashedObj[hashFieldName(property, outerComponent)] = obj[property].map((item: Record<string, any>) => {
          // TODO re-simplify this... only needed because of inconsistent hashing on sub-types / picture
          if (outerComponent === 'logo-tiles') {
            return hashObjectKeys(item, 'picture');
          } else if (outerComponent === 'quotes-slider') {
            return hashObjectKeys(item, 'quote');
          } else if (outerComponent === 'post-head' && property === 'categories') {
            return hashObjectKeys(item, 'tag-label');
          } else {
            return hashObjectKeys(item, outerComponent === 'section' ? item[typeResolutionField] : outerComponent);
          }
        });
      } else if (typeof obj[property] === 'object') {
        // TODO re-simplify this... only needed because of inconsistent hashing on sub-types / link-button
        const outer = outerComponent === 'section' ? obj[property][typeResolutionField] : outerComponent;
        if (outer === 'storytelling' && property === 'link') {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], 'link-button');
        } else if (outer === 'storytelling' && property === 'headline') {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], 'headline');
        } else {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], outer);
        }
      } else {
        hashedObj[hashFieldName(property, outerComponent === 'section' ? 'section' : outerComponent)] = obj[property];
      }
    }
  });

  return hashedObj;
};

export function getSchemaName(schemaId: string | undefined): string {
  return schemaId && schemaId.split('/').pop()?.split('.').shift() || '';
};

function getLayeredRefId(ajv: Ajv, refId: string, reffingSchemaId: string): string {
  if (!refId.includes('frontend.ruhmesmeile.com')) return refId;

  const component = path.basename(refId);
  const layeredComponent = Object.keys(ajv.schemas).filter((schemaId) => schemaId.includes(component) && !schemaId.includes('frontend.ruhmesmeile.com'))

  return layeredComponent.length > 0 && reffingSchemaId.includes('frontend.ruhmesmeile.com')
    ? layeredComponent[0]
    : refId;
}

const dedupe = (schema: JSONSchema7, optionalName?: string): {
    [key: string]: JSONSchema7Definition;
  } | undefined =>
  _.mapKeys(schema.properties, (prop: JSONSchema7, fieldName: string) => 
    fieldName.includes('__') ? fieldName : hashFieldName(fieldName, optionalName)
  );

export function getSchemaReducer(ajv: Ajv, definitions: JSONSchema7[]) {
  allDefinitions = definitions;

  function schemaReducer(knownTypes: GraphQLTypeMap, schema: JSONSchema7) {
    const $id = schema.$id
    if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.');

    const typeName = getTypeName($id);
    const clonedSchema = _.cloneDeep(schema);
  
    if (shouldDedupe) 
      clonedSchema.properties = dedupe(clonedSchema, getSchemaName(schema.$id));
  
    knownTypes[typeName] = buildType(typeName, clonedSchema, knownTypes, shouldDedupe, true, clonedSchema);
    return knownTypes;
  }

  function buildType(
    propName: string,
    schema: JSONSchema7,
    knownTypes: GraphQLTypeMap,
    dedupeFieldNames: boolean,
    outerRun: boolean = false,
    outerSchema: JSONSchema7,
  ): GraphQLType {
    const sectionComponent = (outerSchema.$id?.includes('section.schema.json'));
    const contentComponent = outerRun && !sectionComponent;
    const name = uppercamelcase(cleanFieldName(propName));
  
    // oneOf?
    if (!_.isUndefined(schema.oneOf)) {
      const description = buildDescription(schema);
  
      const cases = schema.oneOf as JSONSchema7;
      const caseKeys = Object.keys(cases);
      const types: GraphQLObjectType[] = caseKeys.map((caseIndex: string) => {
        const caseSchema = cases[caseIndex];
        const typeSchema = _.cloneDeep(caseSchema.then || caseSchema) as JSONSchema7;
        const qualifiedName = `${name}_${getSchemaName(typeSchema.$ref) || caseIndex}`;
        
        if (dedupeFieldNames)
          typeSchema.properties = dedupe(typeSchema, getSchemaName(outerSchema.$id));
        
        return buildType(qualifiedName, typeSchema, knownTypes, dedupeFieldNames, false, outerSchema) as GraphQLObjectType;
      })
      
      return new GraphQLUnionType({ name, description, types });
    }
  
    // anyOf?
    else if (!_.isUndefined(schema.anyOf)) {
      const description = buildDescription(schema);
  
      const cases = schema.anyOf as JSONSchema7;
      const caseKeys = Object.keys(cases);
      const types: GraphQLObjectType[] = caseKeys.map((caseIndex: string) => {
        const caseSchema = cases[caseIndex];
        const typeSchema = _.cloneDeep(caseSchema.then || caseSchema) as JSONSchema7;
        const qualifiedName = `${name}_${getSchemaName(typeSchema.$ref) || caseIndex}`;
       
        if (dedupeFieldNames)
          typeSchema.properties = dedupe(typeSchema, getSchemaName(outerSchema.$id));
  
        return buildType(qualifiedName, typeSchema, knownTypes, dedupeFieldNames, false, outerSchema) as GraphQLObjectType;
      });
  
      return new GraphQLUnionType({ name, description, types });
    }
  
    // allOf?
    else if (!_.isUndefined(schema.allOf)) {
      const reduceSchemaAllOf = (allOfs: JSONSchema7[], outerComponentSchemaId: string): JSONSchema7 => {
        return allOfs.reduce((finalSchema: JSONSchema7, allOf: JSONSchema7) => {
          const mergeSchemaAllOf = (allOf: JSONSchema7): JSONSchema7 => {
            if (!_.isUndefined(allOf.$ref)) {
              if (allOf.$ref.includes('#/definitions/')) {
                const definitionName = allOf.$ref.split('/').pop() || '';
                const definition = _.cloneDeep(allDefinitions[definitionName]);
                if (definition.allOf) {
                  return _.merge(finalSchema, reduceSchemaAllOf(definition.allOf, outerComponentSchemaId))
                }
                return _.merge(finalSchema, definition);
              } else {
                const reffedSchema = _.cloneDeep(ajv.getSchema(getLayeredRefId(ajv, allOf.$ref as string, outerComponentSchemaId))?.schema as JSONSchema7);
                if (reffedSchema.allOf) {
                  return _.merge(finalSchema, reduceSchemaAllOf(reffedSchema.allOf as JSONSchema7[], reffedSchema.$id as string))
                }
                return _.merge(finalSchema, reffedSchema);
              }
            } else {
              return _.merge(finalSchema, allOf);
            }
          };
  
          return mergeSchemaAllOf(allOf);
        }, { } as JSONSchema7);
      };
  
      const objectSchema = reduceSchemaAllOf(schema.allOf as JSONSchema7[], outerSchema.$id as string);
  
      if (dedupeFieldNames)
        objectSchema.properties = dedupe(objectSchema, getSchemaName(outerSchema.$id));
  
      if (contentComponent && objectSchema && objectSchema.properties)
        objectSchema.properties[typeResolutionField] = internalTypeDefinition;
  
      return buildType(name, objectSchema, knownTypes, dedupeFieldNames, outerRun, outerSchema) as GraphQLObjectType;
    }
  
    // not?
    else if (!_.isUndefined(schema.not)) {
      console.log('schema with not', schema);
      throw err(`The type not on property ${name} is not supported.`);
    }
  
    // object?
    else if (schema.type === 'object') {
      const description = buildDescription(schema);
  
      if (contentComponent && schema && schema.properties)
        schema.properties[typeResolutionField] = internalTypeDefinition;
  
      const fields = () =>
        !_.isEmpty(schema.properties)
          ? _.mapValues(schema.properties, (prop: JSONSchema7, fieldName: string) => {
              const qualifiedFieldName = `${name}.${fieldName}`
              const objectSchema = _.cloneDeep(prop);
  
              if (dedupeFieldNames)
                objectSchema.properties = dedupe(objectSchema, getSchemaName(outerSchema.$id));
  
              const type = buildType(qualifiedFieldName, objectSchema, knownTypes, dedupeFieldNames, false, outerSchema) as GraphQLObjectType
              const isRequired = _.includes(schema.required, fieldName)
              return {
                type: isRequired ? new GraphQLNonNull(type) : type,
                description: buildDescription(objectSchema),
              }
            })
          : // GraphQL doesn't allow types with no fields, so put a placeholder
            { _empty: { type: GraphQLString } };
  
      const interfaces = contentComponent ? [contentComponentInterface] : [];
      return new GraphQLObjectType({ name, description, fields, interfaces });
    }
  
    // array?
    else if (schema.type === 'array') {
      const arraySchema = _.cloneDeep(schema.items) as JSONSchema7;
      arraySchema.properties = dedupe(arraySchema, getSchemaName(outerSchema.$id));
  
      const elementType = buildType(name, arraySchema, knownTypes, dedupeFieldNames, false, outerSchema);
      return name === 'SectionComponentContent'
        ? new GraphQLList(new GraphQLNonNull(contentComponentInterface))
        : new GraphQLList(new GraphQLNonNull(elementType));
    }
  
    // enum?
    else if (!_.isUndefined(schema.enum)) {
      if (schema.type !== 'string') throw err(`Only string enums are supported.`, name);
      const description = buildDescription(schema);
      const graphqlToJsonMap = _.keyBy(schema.enum, graphqlSafeEnumKey);
      const values = _.mapValues(graphqlToJsonMap, (value: string) => ({ value }));
      const enumType = new GraphQLEnumType({ name, description, values });
      return enumType;
    }
  
    // ref?
    else if (!_.isUndefined(schema.$ref)) {
      if (schema.$ref.includes('#/definitions/')) {
        const ref = schema.$ref.split('#/definitions/').pop() as string;
        const definitions = _.cloneDeep(allDefinitions[ref]);
  
        if (dedupeFieldNames)
          definitions.properties = dedupe(definitions, getSchemaName(outerSchema.$id));      
  
        if (!allDefinitionTypes[ref]) {
          allDefinitionTypes[ref] = buildType(ref, definitions, knownTypes, shouldDedupe, false, schema);
        }

        return allDefinitionTypes[ref];
      } else {
        const ref = getTypeName(schema.$ref, outerSchema.$id)
        const type = knownTypes[ref];
  
        if (!type) throw err(`The referenced type ${ref} is unknown.`, name);
        return type;
      }
    }

    // image source?
    else if (gatsbyImages && schema.type as string === 'string' && schema.format === 'image') {
      return gatsbyFileInterface;
    }
  
    // basic?
    else if (BASIC_TYPE_MAPPING[schema.type as string]) {
      return BASIC_TYPE_MAPPING[schema.type as string];
    }
  
    // ¯\_(ツ)_/¯
    else throw err(`The type ${schema.type} on property ${name} is unknown.`);
  }

  return schemaReducer;
}

function buildDescription(d: any): string | undefined {
  if (d.title && d.description) return `${d.title}: ${d.description}`;
  return d.title || d.description || undefined;
}
