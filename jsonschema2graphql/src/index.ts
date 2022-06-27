import { getSchemasForIds, dedupeDeep } from '@kickstartds/jsonschema-utils/dist/helpers';
import { getSchemaReducer } from './schemaReducer';
import { ConvertParams, GraphQLTypeMap } from './@types';
import { GraphQLSchema } from 'graphql';
import { createConfig } from './createConfig';

// TODO correct parameter documentation
/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export const convert = ({
  schemaIds,
  ajv,
  schemaPost = dedupeDeep,
}: ConvertParams): GraphQLTypeMap =>
  getSchemasForIds(schemaIds, ajv)
    .reduce(getSchemaReducer(schemaPost), {});

export { GraphQLSchema, createConfig };
