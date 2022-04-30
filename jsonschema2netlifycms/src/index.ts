import { JSONSchema7 } from 'json-schema';

import { getSchemaReducer } from './schemaReducer';
import { ConvertParams, NetlifyCmsField, NetlifyCmsConfig } from './@types';
import { toArray, toSchema } from '@kickstartds/jsonschema-utils/dist/helpers';

import { createConfig } from './createConfig';

// import needed types to type the result

// TODO correct parameter documentation
/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export default function convert({
  jsonSchemas,
  ajv,
}: ConvertParams): NetlifyCmsField[] {
  const schemaArray: JSONSchema7[] = toArray(jsonSchemas).map(toSchema);
  const schemaReducer = getSchemaReducer(ajv);

  return schemaArray.reduce(schemaReducer, []);
}

export { NetlifyCmsConfig, createConfig };
