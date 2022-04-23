import { JSONSchema7 } from 'json-schema';
import { readFileSync, existsSync } from 'fs-extra';

import { config } from './schemaReducer'
import { ConvertParams } from './@types';
import { toArray, toSchema } from '@kickstartds/jsonschema-utils/dist/helpers';



// import needed types to type the result
import { ComponentsCollection } from './@types';

// import locally needed utils



const defaultConfig: ComponentsCollection = {
  components: []
};

// TODO correct parameter documentation
/**
 * @param jsonSchema - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export default function convert({
  jsonSchema,
  definitions,
  ajv,
  configLocation,
}: ConvertParams): string {
  const schemaArray: JSONSchema7[] = toArray(jsonSchema).map(toSchema);
  const contentFields = config(ajv, definitions, schemaArray);

  const baseConfig = configLocation && existsSync(configLocation) ? JSON.parse(readFileSync(configLocation, 'utf-8')) as ComponentsCollection : defaultConfig;

  const contentComponents = contentFields[0].subFields.find((subField) => subField.name === 'sections')
    .subFields.find((subField) => subField.name === 'content').subFields;

  const configString = `${JSON.stringify(contentComponents, null, 2)}`;
  return configString;
}

export function createConfig() {
  
};
