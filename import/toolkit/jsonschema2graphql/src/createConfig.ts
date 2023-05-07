import { GraphQLSchema } from 'graphql';
import { GraphQLTypeMap } from './@types';
import { DEFAULT_ENTRY_POINTS } from './helpers';

// TODO correct parameter documentation
/**
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
export const createConfig = (
  types: GraphQLTypeMap,
  entryPoints = DEFAULT_ENTRY_POINTS,
): GraphQLSchema =>
  new GraphQLSchema({
    ...types,
    ...entryPoints(types),
  });