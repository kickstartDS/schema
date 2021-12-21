import { JSONSchema7 } from 'json-schema';
import {
  dump as yamlDump,
  load as yamlLoad
} from 'js-yaml';
import { readFileSync, existsSync } from 'fs-extra';

import { configGenerator } from './schemaReducer'
import { ConvertParams, NetlifyCmsConfig, NetlifyCmsCollection, NetlifyCmsField } from './@types'

const defaultConfig: NetlifyCmsConfig = {
  backend: {
    name: 'git-gateway',
    branch: 'master',
  },
  local_backend: true,
  locale: 'de',
  media_folder: 'static/images',
  public_folder: '/images',
  publish_mode: 'editorial_workflow',
  logo_url: 'https://example.com/logo.png',
  collections: [],
}

function createConfig(
  contentFields: NetlifyCmsField[],
  baseConfig: NetlifyCmsConfig,
  collectionName: string = 'pages',
): NetlifyCmsConfig {
  const defaultMetaFields: NetlifyCmsField[] = [
    { label: 'Title', name: 'title', widget: 'string' },
    { label: 'Page URL', name: 'url', widget: 'string' },
    {
      label: 'Meta',
      name: 'meta',
      widget: 'object',
      fields: [
        { label: 'Title', name: 'title', widget: 'string' },
        { label: 'Description', name: 'description', widget: 'string' },
      ],
    },
  ]

  // TODO re-introduce `...defaultMetaFields` -> SEO
  const pages: NetlifyCmsCollection = {
    name: collectionName,
    label: 'Pages',
    label_singular: "Page",
    description: "Pages consisting of default content elements",
    folder: 'content',
    create: true,
    delete: true,
    identifier_field: 'title',
    extension: 'md',
    slug: '{{fields.slug}}',
    fields: contentFields,
  }

  if (!baseConfig.collections) {
    baseConfig.collections = [];
  }

  const sortable = (field: NetlifyCmsField) => field.widget === 'object' || field.widget === 'list';

  const sortFields = (contentFieldA: NetlifyCmsField, contentFieldB: NetlifyCmsField) => {
    if (sortable(contentFieldA) && sortable(contentFieldB)) {
      if (contentFieldA.widget === 'object' && contentFieldB.widget ==='object') {
        return contentFieldA.name > contentFieldB.name ? 1 : -1;
      } else if (contentFieldA.widget === 'object' && contentFieldB.widget === 'list') {
        return -1;
      } else if (contentFieldA.widget === 'list' && contentFieldB.widget ==='object') {
        return 1;
      } else {
        return contentFieldA.name > contentFieldB.name ? 1 : -1;
      }
    } else if (sortable(contentFieldA) && !sortable(contentFieldB)) {
      return 1;
    } else if (!sortable(contentFieldA) && sortable(contentFieldB)) {
      return -1;
    } else {
      return contentFieldA.name > contentFieldB.name ? 1 : -1;
    }
  };

  const sortFieldsDeep = (fields: NetlifyCmsField[]) => {
    const sortedFields = fields.sort(sortFields);

    sortedFields.forEach((sortedField) => {
      if (sortedField.widget === 'list' && sortedField.types) {
        sortedField.types = sortFieldsDeep(sortedField.types);
      } else if (sortedField.widget === 'list' && sortedField.fields) {
        sortedField.fields = sortFieldsDeep(sortedField.fields);
      } else if (sortedField.widget === 'object' && sortedField.fields) {
        sortedField.fields = sortFieldsDeep(sortedField.fields);
      }
    });

    return sortedFields;
  };

  const sortedFields = sortFieldsDeep(contentFields);

  let pagesCollection = baseConfig.collections.find(
    (collection) => collection.name === collectionName
  );
  if (pagesCollection) {
    pagesCollection.fields = sortedFields;
  } else {
    baseConfig.collections.push(pages);
  }

  return baseConfig;
}

/**
 * @param jsonSchema - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export default function convert({ jsonSchema, definitions, ajv, configLocation, getSchema }: ConvertParams): string {
  // coerce input to array of schema objects
  const schemaArray: JSONSchema7[] = toArray(jsonSchema).map(toSchema);
  const contentFields = configGenerator(ajv, definitions, schemaArray, getSchema);

  const baseConfig = configLocation && existsSync(configLocation) ? yamlLoad(readFileSync(configLocation, 'utf-8')) as NetlifyCmsConfig : defaultConfig;

  const configDisclaimer = '# This file is auto-generated by @kickstartds/jsonschema2netlifycms\n# Don`t change manually, your changes *will* be lost!\n\n';
  const configString = `${configDisclaimer}${yamlDump(createConfig(contentFields[0].fields as NetlifyCmsField[], baseConfig, 'pages'))}`;

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
