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
    internalType: { type: GraphQLString }
  },
});

const internalTypeDefinition: JSONSchema7Definition = {
  "type": "string",
  "title": "Internal type",
  "description": "Internal type for interface resolution",
};

const allDefinitions = {};
// TODO should be an (cli) option
const shouldDedupe = true;

export function cleanFieldName(name: string): string {
  return name.replace(/__.*/i, '');
};

export function hashFieldName(fieldName: string, optionalName?: string): string {
  return `${fieldName}__${createHash('md5').update(fieldName + (optionalName || '')).digest('hex').substr(0,4)}`
};

export function getSchemaName(schemaId: string | undefined): string {
  return schemaId && schemaId.split('/').pop()?.split('.').shift() || '';
};

const dedupe = (schema: JSONSchema7, optionalName?: string): {
    [key: string]: JSONSchema7Definition;
  } | undefined =>
  _.mapKeys(schema.properties, (prop: JSONSchema7, fieldName: string) => 
    fieldName.includes('__') ? fieldName : hashFieldName(fieldName, optionalName)
  );

export function getSchemaReducer(ajv: Ajv) {
  function schemaReducer(knownTypes: GraphQLTypeMap, schema: JSONSchema7) {
    if (schema.$id && !ajv.getSchema(schema.$id)) {
      ajv.addSchema(schema);
    }
    ajv.validateSchema(schema);
  
    const $id = schema.$id
    if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.');
    const typeName = getTypeName($id);
  
    const { definitions } = schema;
    for (const definedTypeName in definitions) {
      allDefinitions[definedTypeName] = definitions[definedTypeName] as JSONSchema7;
    }

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
    // TODO this adds e.g. `Video`, `Image` and `LightboxImage` instead of
    // `TextMediaComponentMediaVideo`, `TextMediaComponentMediaImage` and
    // `TextMediaComponentMediaLightboxImage` (for TextMediaComponent)
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
      const reduceSchemaAllOf = (allOfs: JSONSchema7[]): JSONSchema7 => {
        return allOfs.reduce((finalSchema: JSONSchema7, allOf: JSONSchema7) => {
          const mergeSchemaAllOf = (allOf: JSONSchema7): JSONSchema7 => {
            if (!_.isUndefined(allOf.$ref)) {
              if (allOf.$ref.includes('#/definitions/')) {
                const definitionName = allOf.$ref.split('/').pop() || '';
                const definition = _.cloneDeep(allDefinitions[definitionName]);
                if (definition.allOf) {
                  return _.merge(finalSchema, reduceSchemaAllOf(definition.allOf))
                }
                return _.merge(finalSchema, definition);
              } else {
                const reffedSchema = _.cloneDeep(ajv.getSchema(allOf.$ref)?.schema as JSONSchema7);
                if (reffedSchema.allOf) {
                  return _.merge(finalSchema, reduceSchemaAllOf(reffedSchema.allOf as JSONSchema7[]))
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
  
      const objectSchema = reduceSchemaAllOf(schema.allOf as JSONSchema7[]);
  
      if (dedupeFieldNames)
        objectSchema.properties = dedupe(objectSchema, getSchemaName(outerSchema.$id));
  
      if (contentComponent && objectSchema && objectSchema.properties)
        objectSchema.properties.internalType = internalTypeDefinition;
  
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
        schema.properties.internalType = internalTypeDefinition;
  
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
      const ref = schema.$ref.includes('#/definitions/') && schema.$ref.includes('http')
        ? getTypeName(schema.$ref, schema.$ref.split('#').shift())
        : getTypeName(schema.$ref, outerSchema.$id);
  
      if (schema.$ref.includes('#/definitions/')) {
        const ref = schema.$ref.split('#/definitions/').pop() as string;
        const definitions = _.cloneDeep(allDefinitions[ref]);
  
        if (dedupeFieldNames)
          definitions.properties = dedupe(definitions, getSchemaName(outerSchema.$id));      
  
        return buildType(ref, definitions, knownTypes, shouldDedupe, false, schema);;
      } else {
        const ref = getTypeName(schema.$ref, outerSchema.$id)
        const type = knownTypes[ref];
  
        if (!type) throw err(`The referenced type ${ref} is unknown.`, name);
        return type;
      }
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
