import { GraphQLSchema } from 'graphql';
import { GraphQLTypeMap } from './@types';
import { DEFAULT_ENTRY_POINTS } from './helpers';

export function createConfig(
  types: GraphQLTypeMap,
  entryPoints = DEFAULT_ENTRY_POINTS,
): GraphQLSchema {
  return new GraphQLSchema({
    ...types,
    ...entryPoints(types),
  });
};