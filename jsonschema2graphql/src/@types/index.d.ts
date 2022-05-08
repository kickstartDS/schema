import { GraphQLObjectType, GraphQLType, GraphQLSchema } from 'graphql'
import Ajv from 'ajv/dist/core'

export interface ConvertParams {
  schemaIds: string[]
  ajv: Ajv
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
