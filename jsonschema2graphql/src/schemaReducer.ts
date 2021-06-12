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

const ajv = new Ajv({
  removeAdditional: true,
  validateSchema: true,
  schemaId: '$id',
  allErrors: true,
});

const ignoredFormats = ['image', 'video', 'color', 'markdown', 'id'];
ignoredFormats.forEach((ignoredFormat) =>
  ajv.addFormat(ignoredFormat, { validate: () => true })
);

ajv.addKeyword({
  keyword: 'faker',
  validate: () => true,
  errors: false,
});

const contentComponentInterface = new GraphQLInterfaceType({
  name: 'ContentComponent',
  fields: {
    type: { type: GraphQLString }
  },
});

const allDefinitions = {};
const allContentComponentFieldNames: Array<string> = [];
const dedupeFieldNames = true;

const clean = (name: string): string => {
  return name.replace(/__.*/i, '');
};

const dedupe = (schema: JSONSchema7, optionalName?: string): {
    [key: string]: JSONSchema7Definition;
  } | undefined => 
  _.mapKeys(schema.properties, (prop: JSONSchema7, fieldName: string) => {
    const unique = !allContentComponentFieldNames.includes(fieldName);

    // TODO: currently the reducer logic (especially for `allOf`, `oneOf`, `anyOf`) seems to 
    // result in some fieldNames being deduped twice, which this fixes for now. Should be
    // done more elegantly
    if (fieldName.includes('__'))
      return fieldName;
    
    // TODO this correctly matches `ButtonComponentVariant` === `LinkButtonComponentVariant`,
    // and as such generates the same unique hash. Would need to extract a common fragment here, theoretically.
    // added `+ schema.$id` below, to make those instances "unique" again to avoid collisions
    // (because `ButtonComponentVariant` !== `LinkButtonComponentVariant`, and therefore conflicting types for `variant` gql field)
    // const uniqueName = unique ? fieldName : `${fieldName}__${createHash('md5').update(JSON.stringify(prop)).digest('hex').substr(0,4)}`;
    
    const uniqueName = unique ? fieldName : `${fieldName}__${createHash('md5').update(JSON.stringify(prop) + (optionalName || '')).digest('hex').substr(0,4)}`;
    allContentComponentFieldNames.push(uniqueName);
    
    return uniqueName;
  });

export function schemaReducer(knownTypes: GraphQLTypeMap, schema: JSONSchema7) {
  // validate against the json schema schema
  if (schema.$id && !ajv.getSchema(schema.$id)) {
    ajv.addSchema(schema);
  }
  ajv.validateSchema(schema);

  const $id = schema.$id
  if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.');
  const typeName = getTypeName($id);

  // definitions
  const { definitions } = schema;
  for (const definedTypeName in definitions) {
    const definedSchema = definitions[definedTypeName] as JSONSchema7;

    if (dedupeFieldNames)
      definedSchema.properties = dedupe(definedSchema);

    knownTypes[getTypeName(definedTypeName)] = buildType(definedTypeName, definedSchema, knownTypes, true);
    allDefinitions[definedTypeName] = definedSchema;
  }

  if (dedupeFieldNames) 
    schema.properties = dedupe(schema);

  knownTypes[typeName] = buildType(typeName, schema, knownTypes, true);
  return knownTypes;
}

function buildType(propName: string, schema: JSONSchema7, knownTypes: GraphQLTypeMap, outerRun: boolean = false): GraphQLType {
  const contentComponent = outerRun && (schema.$id?.indexOf('section.schema.json') === -1 );
  const name = uppercamelcase(clean(propName));

  // oneOf?
  if (!_.isUndefined(schema.oneOf)) {
    const description = buildDescription(schema);

    const cases = schema.oneOf as JSONSchema7;
    const caseKeys = Object.keys(cases);
    const types: GraphQLObjectType[] = caseKeys.map((caseName: string) => {
      const caseSchema = cases[caseName];
      const qualifiedName = `${name}_${caseName}`;
      const typeSchema = (caseSchema.then || caseSchema) as JSONSchema7;
      
      if (outerRun && dedupeFieldNames)
        typeSchema.properties = dedupe(typeSchema);
      
      return buildType(qualifiedName, typeSchema, knownTypes) as GraphQLObjectType;
    })
    
    return new GraphQLUnionType({ name, description, types });
  }

  // anyOf?
  else if (!_.isUndefined(schema.anyOf)) {
    const description = buildDescription(schema);

    const cases = schema.anyOf as JSONSchema7;
    const caseKeys = Object.keys(cases);
    const types: GraphQLObjectType[] = caseKeys.map((caseName: string) => {
      const caseSchema = cases[caseName];
      const qualifiedName = `${name}_${caseName}`;
      const typeSchema = (caseSchema.then || caseSchema) as JSONSchema7;

      if (outerRun && dedupeFieldNames)
        typeSchema.properties = dedupe(typeSchema);

      return buildType(qualifiedName, typeSchema, knownTypes) as GraphQLObjectType;
    })
    
    return new GraphQLUnionType({ name, description, types });
  }

  // allOf?
  else if (!_.isUndefined(schema.allOf)) {
    const description = buildDescription(schema);

    const allOfs = schema.allOf as JSONSchema7[];
    const fields = () => {
      const objectSchema: JSONSchema7 = allOfs.reduce((finalSchema: JSONSchema7, allOf: JSONSchema7) => {
        if (!_.isUndefined(allOf.$ref)) {
          if (allOf.$ref.indexOf('definitions') > -1) {
            const definitionName = allOf.$ref.split('/').pop() || '';
            return _.merge(finalSchema, allDefinitions[definitionName]);
          } else {
            return _.merge(finalSchema, ajv.getSchema(allOf.$ref)?.schema);
          }
          
        } else {
          return _.merge(finalSchema, allOf);
        }
      }, {} as JSONSchema7);

      if (outerRun && dedupeFieldNames)
        objectSchema.properties = dedupe(objectSchema, schema.$id);

      if (contentComponent && objectSchema && objectSchema.properties) {
        objectSchema.properties.type = {
          "type": "string",
          "title": "Internal type",
          "description": "Internal type for interface resolution",
        };
      }

      return !_.isEmpty(objectSchema.properties)
        ? _.mapValues(objectSchema.properties, (prop: JSONSchema7, fieldName: string) => {
            const qualifiedFieldName = `${name}.${fieldName}`;
            const type = buildType(qualifiedFieldName, prop, knownTypes) as GraphQLObjectType;
            const isRequired = _.includes(objectSchema.required, fieldName);

            return {
              type: isRequired ? new GraphQLNonNull(type) : type,
              description: buildDescription(prop),
            };
          })
        : // GraphQL doesn't allow types with no fields, so put a placeholder
          { _empty: { type: GraphQLString } };
    };

    const interfaces = contentComponent ? [contentComponentInterface] : [];
    return new GraphQLObjectType({ name, description, fields, interfaces });
  }

  // not?
  else if (!_.isUndefined(schema.not)) {
    console.log('schema with not', schema);
    throw err(`The type not on property ${name} is not supported.`);
  }

  // object?
  else if (schema.type === 'object') {
    const description = buildDescription(schema);

    if (contentComponent && schema && schema.properties) {
      schema.properties.type = {
        "type": "string",
        "title": "Internal type",
        "description": "Internal type for interface resolution",
      };
    }

    const fields = () =>
      !_.isEmpty(schema.properties)
        ? _.mapValues(schema.properties, (prop: JSONSchema7, fieldName: string) => {
            const qualifiedFieldName = `${name}.${fieldName}`
            const type = buildType(qualifiedFieldName, prop, knownTypes) as GraphQLObjectType
            const isRequired = _.includes(schema.required, fieldName)
            return {
              type: isRequired ? new GraphQLNonNull(type) : type,
              description: buildDescription(prop),
            }
          })
        : // GraphQL doesn't allow types with no fields, so put a placeholder
          { _empty: { type: GraphQLString } };

    const interfaces = contentComponent ? [contentComponentInterface] : [];
    return new GraphQLObjectType({ name, description, fields, interfaces });
  }

  // array?
  else if (schema.type === 'array') {
    const elementType = buildType(name, schema.items as JSONSchema7, knownTypes);
    return new GraphQLList(new GraphQLNonNull(elementType));
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
    const ref = getTypeName(schema.$ref);
    const type = knownTypes[ref];
    if (!type) throw err(`The referenced type ${ref} is unknown.`, name);
    return type;
  }

  // basic?
  else if (BASIC_TYPE_MAPPING[schema.type as string]) {
    return BASIC_TYPE_MAPPING[schema.type as string];
  }

  // ¯\_(ツ)_/¯
  else throw err(`The type ${schema.type} on property ${name} is unknown.`);
}

function buildDescription(d: any): string | undefined {
  if (d.title && d.description) return `${d.title}: ${d.description}`;
  return d.title || d.description || undefined;
}
