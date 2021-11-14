import { JSONSchema7 } from 'json-schema';
import { inspect } from 'util';

import { schemaGenerator } from './schemaReducer';
import { ConvertParams } from './@types';

/**
 * @param jsonSchema - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export default function convert({ jsonSchema, definitions, ajv }: ConvertParams): Record<string, string> {
  // coerce input to array of schema objects
  const schemaArray: JSONSchema7[] = toArray(jsonSchema).map(toSchema);
  const contentFields = schemaGenerator(ajv, definitions, schemaArray);
  const schemaDisclaimer = '// This file is auto-generated by @kickstartds/jsonschema2sanity\n// Don`t change manually, your changes *will* be lost!'; 

  return contentFields.reduce((map, contentField) => {
    map[contentField.name] = `${schemaDisclaimer}\n\nexport default ${inspect(contentField, {showHidden: false, compact: false, depth: null})}`;
    return map;
  }, {});
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
