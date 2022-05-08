import { getSchemasForIds } from '@kickstartds/jsonschema-utils/dist/helpers';
import { getSchemaReducer } from './schemaReducer';
import { ConvertParams, NetlifyCmsField, NetlifyCmsConfig } from './@types';
import { createConfig } from './createConfig';

// TODO correct parameter documentation
/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export const convert = ({
  schemaIds,
  ajv,
}: ConvertParams): NetlifyCmsField[] =>
  getSchemasForIds(schemaIds, ajv)
    .reduce(getSchemaReducer(ajv), []);

export { NetlifyCmsConfig, createConfig };
