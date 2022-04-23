import { JSONSchema7 } from 'json-schema';
import { readFileSync, existsSync } from 'fs-extra';

import { config } from './schemaReducer'
import { ConvertParams } from './@types'
import { toArray, toSchema } from '@kickstartds/jsonschema-utils/dist/helpers';



// import needed types to type the result
import { TinaCloudSchema, TinaCloudCollection, TinaFieldInner, ObjectType } from 'tinacms/dist/types';

// import locally needed utils
import { capitalize } from '@kickstartds/jsonschema-utils/dist/helpers';

const defaultConfig: TinaCloudSchema<false> = {
  collections: []
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
  collectionName = 'pages'
}: ConvertParams): string {
  const schemaArray: JSONSchema7[] = toArray(jsonSchema).map(toSchema);
  const contentFields = config(ajv, definitions, schemaArray);

  const baseConfig = configLocation && existsSync(configLocation) ? JSON.parse(readFileSync(configLocation, 'utf-8')) as TinaCloudSchema<false> : defaultConfig;

  const configString = `${JSON.stringify(createConfig((contentFields[0] as ObjectType<false>).fields as TinaFieldInner<false>[], baseConfig, collectionName), null, 2)}`;
  return configString;
}

export function createConfig(
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
};
