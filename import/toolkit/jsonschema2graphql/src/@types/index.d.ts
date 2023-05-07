import { GraphQLObjectType, GraphQLType, GraphQLSchema } from 'graphql'
import { JSONSchema7 } from 'json-schema'
import Ajv from 'ajv/dist/core'

export interface ConvertParams {
  schemaIds: string[]
  ajv: Ajv
  componentInterfaces?: Record<string, string[]>
  gatsbyImages?: boolean
  schemaPost?: (schema: JSONSchema7) => JSONSchema7
}

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

export { GraphQLSchema };
