import { JSONSchema7 } from 'json-schema';
import { dump } from 'js-yaml';

import { schemaReducer } from './schemaReducer'
import { ConvertParams, NetlifyCmsConfig, NetlifyCmsCollection, NetlifyCmsField } from './@types'

function createConfig(contentFields: NetlifyCmsField[]): NetlifyCmsConfig {
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
  
  const pages: NetlifyCmsCollection = {
    name: 'pages',
    label: 'Pages',
    label_singular: "Page",
    description: "Pages consisting of default content element",
    folder: 'content',
    create: true,
    delete: true,
    extension: 'md',
    slug: 'page/{{slug}}',
    fields: [
      // ...defaultMetaFields, // TODO re-introduce for SEO
      { label: "Id", name: "Id", description: "Id", widget: "id" },
      { label: 'Layout', name: 'layout', description: "Layout to use", widget: 'hidden', default: 'pages' },
      { label: "Heading", name: "heading", description: "Main headline of the page", widget: "string" },
      {
        label: "Content",
        name: "content",
        description: "Content for the page",
        widget: "list",
        types: contentFields,
      }
    ],
  }
  
  const config: NetlifyCmsConfig = {
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
    collections: [pages],
  }

  return config;  
}

/**
 * @param jsonSchema - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export default function convert({ jsonSchema }: ConvertParams): string {
  // coerce input to array of schema objects
  const schemaArray: JSONSchema7[] = toArray(jsonSchema).map(toSchema);
  const contentFields: NetlifyCmsField[] = schemaArray.reduce(schemaReducer, []);

  const configDisclaimer = '# This file is auto-generated by @kickstartds/jsonschema2netlifycms\n# Don`t change manually, your changes *will* be lost!\n\n'; 
  const configString = `${configDisclaimer}${dump(createConfig(contentFields))}`;

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
