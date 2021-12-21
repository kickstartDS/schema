import { GraphQLObjectType, GraphQLType } from 'graphql'
import { JSONSchema7 } from 'json-schema'
import Ajv from 'ajv/dist/core'

declare namespace jsonschema2graphql {
  export interface GraphQLTypeMap {
    [name: string]: GraphQLType
  }

  export type EntryPointBuilder = (types: GraphQLTypeMap) => {
    query: GraphQLObjectType
    mutation?: GraphQLObjectType
    subscription?: GraphQLObjectType
  }

  export type GetSchema = (id: string) => JSONSchema7

  export interface ConvertParams {
    jsonSchema: JSONSchema7 | JSONSchema7[] | string | string[]
    definitions: JSONSchema7[]
    entryPoints?: EntryPointBuilder
    ajv: Ajv
    getSchema: GetSchema
  }
}

export = jsonschema2graphql
