import { JSONSchema7 } from 'json-schema';

import { getSchemaReducer } from './schemaReducer';
import { ConvertParams, NetlifyCmsField, NetlifyCmsConfig } from './@types';

import { createConfig } from './createConfig';

// import needed types to type the result

// TODO correct parameter documentation
/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export default function convert({
  schemaIds,
  ajv,
}: ConvertParams): NetlifyCmsField[] {
  const schemaArray = schemaIds.map((schemaId) =>
    ajv.getSchema<JSONSchema7>(schemaId).schema as JSONSchema7
  );
  
  return schemaArray.reduce(getSchemaReducer(ajv), []);
}

export { NetlifyCmsConfig, createConfig };
