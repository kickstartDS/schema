import { GraphQLObjectType, GraphQLType } from 'graphql'
import { JSONSchema7 } from 'json-schema'
import Ajv from 'ajv/dist/core'

declare namespace jsonschema2graphql {
  export interface GraphQLTypeMap {
    [name: string]: GraphQLType
  }

  export type EntryPointBuilder = (
    types: GraphQLTypeMap
  ) => {
    query: GraphQLObjectType
    mutation?: GraphQLObjectType
    subscription?: GraphQLObjectType
  }

  export interface ConvertParams {
    schemaIds: string[]
    entryPoints?: EntryPointBuilder
    ajv: Ajv
  }
}

export = jsonschema2graphql
