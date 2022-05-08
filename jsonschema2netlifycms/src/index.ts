import { JSONSchema7 } from 'json-schema';
import { getSchemasForIds } from '@kickstartds/jsonschema-utils/dist/helpers';

import { getSchemaReducer } from './schemaReducer';
import { ConvertParams, NetlifyCmsField, NetlifyCmsConfig } from './@types';

import { createConfig } from './createConfig';

// TODO correct parameter documentation
/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export default function convert({
  schemaIds,
  ajv,
}: ConvertParams): NetlifyCmsField[] {
  const schemaArray = getSchemasForIds(schemaIds, ajv);
  
  return schemaArray.reduce(getSchemaReducer(ajv), []);
}

export { NetlifyCmsConfig, createConfig };
