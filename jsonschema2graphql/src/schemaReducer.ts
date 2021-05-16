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
} from 'graphql'
import { JSONSchema7 } from 'json-schema'
import _ from 'lodash'
import uppercamelcase from 'uppercamelcase'
import { GraphQLTypeMap } from './@types'
import { getTypeName } from './getTypeName'
import { graphqlSafeEnumKey } from './graphqlSafeEnumKey'
import { err } from './helpers'
import Ajv from 'ajv'

/** Maps basic JSON schema types to basic GraphQL types */
const BASIC_TYPE_MAPPING = {
  string: GraphQLString,
  integer: GraphQLInt,
  number: GraphQLFloat,
  boolean: GraphQLBoolean,
}

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

const contentComponentInterface = new GraphQLInterfaceType({
  name: 'ContentComponent',
  fields: {
    type: { type: GraphQLString }
  },
});

export function schemaReducer(knownTypes: GraphQLTypeMap, schema: JSONSchema7) {
  // validate against the json schema schema
  if (schema.$id && !ajv.getSchema(schema.$id)) {
    ajv.addSchema(schema);
  }
  ajv.validateSchema(schema)

  const $id = schema.$id
  if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.')
  const typeName = getTypeName($id)

  // definitions
  const { definitions } = schema
  for (const definedTypeName in definitions) {
    const definedSchema = definitions[definedTypeName] as JSONSchema7
    knownTypes[getTypeName(definedTypeName)] = buildType(definedTypeName, definedSchema, knownTypes, true)
  }

  knownTypes[typeName] = buildType(typeName, schema, knownTypes, true)
  return knownTypes
}

function buildType(propName: string, schema: JSONSchema7, knownTypes: GraphQLTypeMap, outerRun: boolean = false): GraphQLType {
  const name = uppercamelcase(propName)

  // oneOf?
  if (!_.isUndefined(schema.oneOf)) {
    const description = buildDescription(schema)

    const cases = schema.oneOf as JSONSchema7
    const caseKeys = Object.keys(cases)
    const types: GraphQLObjectType[] = caseKeys.map((caseName: string) => {
      const caseSchema = cases[caseName]
      const qualifiedName = `${name}_${caseName}`
      const typeSchema = (caseSchema.then || caseSchema) as JSONSchema7
      return buildType(qualifiedName, typeSchema, knownTypes) as GraphQLObjectType
    })
    
    return new GraphQLUnionType({ name, description, types })
  }

  // anyOf?
  else if (!_.isUndefined(schema.anyOf)) {
    const description = buildDescription(schema)

    const cases = schema.anyOf as JSONSchema7
    const caseKeys = Object.keys(cases)
    const types: GraphQLObjectType[] = caseKeys.map((caseName: string) => {
      const caseSchema = cases[caseName]
      const qualifiedName = `${name}_${caseName}`
      const typeSchema = (caseSchema.then || caseSchema) as JSONSchema7
      return buildType(qualifiedName, typeSchema, knownTypes) as GraphQLObjectType
    })
    
    return new GraphQLUnionType({ name, description, types })
  }

  // allOf?
  else if (!_.isUndefined(schema.allOf)) {
    const description = buildDescription(schema);

    const allOfs = schema.allOf as JSONSchema7[];
    const fields = () => {
      const objectSchema: JSONSchema7 = allOfs.reduce((finalSchema: JSONSchema7, allOf: JSONSchema7) => {
        if (!_.isUndefined(allOf.$ref)) {
          if (allOf.$ref.indexOf('container') > -1) {
            // console.log(knownTypes[getTypeName(allOf.$ref)]);
            // console.log('ajv.getSchema(allOf.$ref)?.schema', ajv.getSchema(allOf.$ref)?.schema);
          }
          return _.merge(finalSchema, ajv.getSchema(allOf.$ref)?.schema);
        } else {
          return _.merge(finalSchema, allOf);
        }
      }, {} as JSONSchema7);

      if (outerRun && objectSchema && objectSchema.properties) {
        objectSchema.properties.type = {
          "type": "string",
          "title": "Internal type",
          "description": "Internal type for interface resolution",
        }
      }

      return !_.isEmpty(objectSchema.properties)
        ? _.mapValues(objectSchema.properties, (prop: JSONSchema7, fieldName: string) => {
            const qualifiedFieldName = `${name}.${fieldName}`
            const type = buildType(qualifiedFieldName, prop, knownTypes) as GraphQLObjectType
            const isRequired = _.includes(objectSchema.required, fieldName)
            return {
              type: isRequired ? new GraphQLNonNull(type) : type,
              description: buildDescription(prop),
            }
          })
        : // GraphQL doesn't allow types with no fields, so put a placeholder
          { _empty: { type: GraphQLString } }
    };

    const interfaces = outerRun ? [contentComponentInterface] : [];
    return new GraphQLObjectType({ name, description, fields, interfaces });
  }

  // not?
  else if (!_.isUndefined(schema.not)) {
    console.log('schema with not', schema);
    throw err(`The type not on property ${name} is not supported.`)
  }

  // object?
  else if (schema.type === 'object') {
    const description = buildDescription(schema)

    if (outerRun && schema && schema.properties) {
      schema.properties.type = {
        "type": "string",
        "title": "Internal type",
        "description": "Internal type for interface resolution",
      }
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
          { _empty: { type: GraphQLString } }

    const interfaces = outerRun ? [contentComponentInterface] : [];
    return new GraphQLObjectType({ name, description, fields, interfaces })
  }

  // array?
  else if (schema.type === 'array') {
    const elementType = buildType(name, schema.items as JSONSchema7, knownTypes)
    return new GraphQLList(new GraphQLNonNull(elementType))
  }

  // enum?
  else if (!_.isUndefined(schema.enum)) {
    if (schema.type !== 'string') throw err(`Only string enums are supported.`, name)
    const description = buildDescription(schema)
    const graphqlToJsonMap = _.keyBy(schema.enum, graphqlSafeEnumKey)
    const values = _.mapValues(graphqlToJsonMap, (value: string) => ({ value }))
    const enumType = new GraphQLEnumType({ name, description, values })
    return enumType
  }

  // ref?
  else if (!_.isUndefined(schema.$ref)) {
    const ref = getTypeName(schema.$ref)
    const type = knownTypes[ref] 
    if (!type) throw err(`The referenced type ${ref} is unknown.`, name)
    return type
  }

  // basic?
  else if (BASIC_TYPE_MAPPING[schema.type as string]) {
    return BASIC_TYPE_MAPPING[schema.type as string]
  }

  // ¯\_(ツ)_/¯
  else throw err(`The type ${schema.type} on property ${name} is unknown.`)
}

function buildDescription(d: any): string | undefined {
  if (d.title && d.description) return `${d.title}: ${d.description}`
  return d.title || d.description || undefined
}
