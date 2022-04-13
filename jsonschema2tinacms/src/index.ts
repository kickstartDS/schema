import { JSONSchema7 } from 'json-schema';
import { readFileSync, existsSync } from 'fs-extra';

import { configGenerator } from './schemaReducer'
import { ConvertParams } from './@types'

import { TinaCloudSchema, TinaCloudCollection, TinaFieldInner, ObjectType } from 'tinacms/dist/types';

const capitalize = (s: string) => s && s[0].toUpperCase() + s.slice(1);

const defaultConfig: TinaCloudSchema<false> = {
  collections: []
};

function createConfig(
  contentFields: TinaFieldInner<false>[],
  baseConfig: TinaCloudSchema<false>,
  collectionName: string,
): TinaCloudSchema<false> {
  const pages: TinaCloudCollection<false> = {
    name: collectionName,
    label: capitalize(collectionName),
    path: `content/${collectionName}`,
    fields: contentFields,
  }

  if (!baseConfig.collections) {
    baseConfig.collections = [];
  }

  let pagesCollection = baseConfig.collections.find(
    (collection) => collection.name === collectionName
  );
  if (pagesCollection) {
    pagesCollection.fields = contentFields;
  } else {
    baseConfig.collections.push(pages);
  }
  
  return baseConfig;
}

/**
 * @param jsonSchema - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export default function convert({ jsonSchema, definitions, ajv, configLocation, collectionName = 'pages' }: ConvertParams): string {
  // coerce input to array of schema objects
  const schemaArray: JSONSchema7[] = toArray(jsonSchema).map(toSchema);
  const contentFields = configGenerator(ajv, definitions, schemaArray);

  const baseConfig = configLocation && existsSync(configLocation) ? JSON.parse(readFileSync(configLocation, 'utf-8')) as TinaCloudSchema<false> : defaultConfig;

  const configString = `${JSON.stringify(createConfig((contentFields[0] as ObjectType<false>).fields as TinaFieldInner<false>[], baseConfig, collectionName), null, 2)}`;

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
