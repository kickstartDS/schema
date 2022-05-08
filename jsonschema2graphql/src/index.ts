import { getSchemasForIds } from '@kickstartds/jsonschema-utils/dist/helpers';

import { getSchemaReducer } from './schemaReducer';
import { ConvertParams, GraphQLTypeMap } from './@types';
import { GraphQLSchema } from 'graphql';

import { createConfig } from './createConfig';

// TODO correct parameter documentation
/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 *
 * @param entryPoints - By default, each type gets a query field that returns
 * an array of that type. So for example, if you have an `Person` type and a
 * `Post` type, you'll get a query that looks like this:
 *
 * ```graphql
 *    type Query {
 *      people: [Person]
 *      posts: [Posts]
 *    }
 * ```
 *
 * (Note that the name of the query field is [pluralized](https://github.com/blakeembrey/pluralize).)
 *
 * To override this behavior, provide a `queryBlockBuilder` callback that takes
 * a Map of types and returns Query, Mutation (optional), and Subscription (optional)
 * blocks. Each block consists of a hash of `GraphQLFieldConfig`s.
 */
export default function convert({
  schemaIds,
  ajv,
}: ConvertParams): GraphQLTypeMap {
  return getSchemasForIds(schemaIds, ajv)
    .reduce(getSchemaReducer(ajv), {});
}

export { GraphQLSchema, createConfig };
