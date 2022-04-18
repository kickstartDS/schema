import { JSONSchema7 } from 'json-schema';
import { readFileSync, existsSync } from 'fs-extra';

import { Component, Builder } from '@builder.io/sdk/dist/src/builder.class';

import { configGenerator } from './schemaReducer'
import { ConvertParams } from './@types'

const capitalize = (s: string) => s && s[0].toUpperCase() + s.slice(1);

interface ComponentsCollection {
  components: Component[]
};

const defaultConfig: ComponentsCollection = {
  components: []
};

/**
 * @param jsonSchema - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export default function convert({ jsonSchema, definitions, ajv, configLocation, collectionName = 'pages' }: ConvertParams): string {
  // coerce input to array of schema objects
  const schemaArray: JSONSchema7[] = toArray(jsonSchema).map(toSchema);
  const contentFields = configGenerator(ajv, definitions, schemaArray);

  const baseConfig = configLocation && existsSync(configLocation) ? JSON.parse(readFileSync(configLocation, 'utf-8')) as ComponentsCollection : defaultConfig;

  const contentComponents = contentFields[0].subFields.find((subField) => subField.name === 'sections')
    .subFields.find((subField) => subField.name === 'content').subFields;

  const configString = `${JSON.stringify(contentComponents, null, 2)}`;
  return configString;
}

function toArray(x: JSONSchema7 | JSONSchema7[] | string | string[]): any[] {
  return x instanceof Array
    ? x // already array
    : [x] // single item -> array
}

function toSchema(x: JSONSchema7 | string): JSONSchema7 {
  return x instanceof Object
    ? x // already object
    : JSON.parse(x) // string -> object
}
