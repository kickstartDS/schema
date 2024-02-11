import {
  getSchemasForIds,
  toPascalCase,
  getSchemaReducer,
  IProcessInterface,
  safeEnumKey,
  IReducerResult,
  IProcessFnResult,
  IConvertParams,
  capitalize
} from '@kickstartds/jsonschema-utils';
import { dump as yamlDump } from 'js-yaml';
import { type JSONSchema, TypeName } from 'json-schema-typed/draft-07';
import pkg from 'pluralize';

import { IStaticCmsCollection, IStaticCmsConfig, IStaticCmsField } from './@types/index.js';
import { sortFieldsDeep } from './helpers.js';

export * from './@types/index.js';

const { plural, singular } = pkg;

const typeResolutionField: string = 'type';

const defaultConfig: IStaticCmsConfig = {
  backend: {
    name: 'git-gateway',
    branch: 'main'
  },
  local_backend: true,
  locale: 'en',
  media_folder: 'static/images',
  public_folder: '/images',
  publish_mode: 'editorial_workflow',
  logo_url: 'https://example.com/logo.png',
  collections: []
};

export function defaultTemplateConfig(
  collectionName: string,
  folder: string,
  fields: IStaticCmsField[]
): IStaticCmsCollection {
  return {
    name: plural(collectionName),
    label: plural(capitalize(collectionName)),
    label_singular: singular(capitalize(collectionName)),
    description: `${singular(capitalize(collectionName))} documents consisting of default content elements`,
    folder,
    create: true,
    delete: true,
    identifier_field: 'title',
    extension: 'md',
    slug: '{{fields.slug}}',
    fields
  };
}

export function defaultSettingsConfig(
  collectionName: string,
  folder: string,
  fields: IStaticCmsField[]
): IStaticCmsCollection {
  return {
    name: collectionName,
    label: capitalize(collectionName),
    description: `${capitalize(collectionName)} consisting of general configuration options for the page`,
    extension: 'md',
    format: 'yaml-frontmatter',
    files: fields.map((field) => {
      return {
        name: field.name,
        file: `${folder}/${field.name}.md`,
        label: capitalize(field.name),
        fields: field.fields
      };
    })
  };
}

export function configuration(
  converted: IReducerResult<IStaticCmsField> = {
    components: [],
    templates: [],
    globals: []
  },
  config: IStaticCmsConfig = defaultConfig,
  templateConfig: (
    collectionName: string,
    folder: string,
    fields: IStaticCmsField[]
  ) => IStaticCmsCollection = defaultTemplateConfig,
  settingsConfig: (
    collectionName: string,
    folder: string,
    files: IStaticCmsField[]
  ) => IStaticCmsCollection = defaultSettingsConfig
): string {
  for (const template of converted.templates) {
    config.collections ||= [];

    const sorted = sortFieldsDeep([template]).pop();
    if (!sorted || !sorted.fields) throw new Error(`Error while sorting template ${template.name}`);
    const collection = config.collections.find((collection) => collection.name === sorted.name);
    if (collection) collection.fields = sorted.fields;
    else
      config.collections.push(templateConfig(sorted.name, `content/${plural(sorted.name)}`, sorted.fields));
  }

  for (const global of converted.globals) {
    config.collections ||= [];

    const sorted = sortFieldsDeep([global]).pop();
    if (!sorted || !sorted.fields) throw new Error(`Error while sorting global ${global.name}`);
    const collection = config.collections.find((collection) => collection.name === sorted.name);
    const collectionConfig = settingsConfig(sorted.name, 'content/settings', sorted.fields);
    if (collection) collection.files = collectionConfig.files;
    else config.collections.push(collectionConfig);
  }

  return yamlDump(config);
}

// TODO check the generated StaticCmsField properties for all elements:
// * required -> this is not functional yet... needs to be evaluated intelligently,
//      because of schema nesting (schema > array > allOf > $ref > object, etc)
// * hint -> may be affected by the same challenge as `required`
// TODO move `getSchemaReducer`, `IProcessFn` and `safeEnumKey` to `jsonschema-utils`
// TODO correct parameter documentation
/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export function convert({
  schemaIds,
  ajv,
  schemaPost,
  schemaClassifier
}: IConvertParams): IReducerResult<IStaticCmsField> {
  const reduced = getSchemasForIds(schemaIds, ajv).reduce(
    getSchemaReducer<IStaticCmsField>({
      ajv,
      typeResolutionField,
      buildDescription,
      safeEnumKey,
      basicTypeMapping,
      componentsEqual,
      processObject,
      processRef,
      processRefArray,
      processObjectArray,
      processArray,
      processEnum,
      processConst,
      processBasic,
      schemaPost,
      schemaClassifier
    }),
    { components: [], templates: [], globals: [] }
  );

  return reduced;
}

interface ITypeMapping {
  boolean: string;
  string: string;
  integer: string;
  array: string;
  object: string;
  null: string;
  number: string;
}

const mapping: ITypeMapping = {
  [TypeName.String]: 'string',
  [TypeName.Integer]: 'number',
  [TypeName.Boolean]: 'boolean',
  [TypeName.Array]: 'object',
  [TypeName.Object]: 'object',
  [TypeName.Null]: 'null',
  [TypeName.Number]: 'number'
};

function basicTypeMapping(property: JSONSchema.Interface): string {
  if (property.type === 'string' && property.enum && property.enum.length) {
    return 'select';
  }

  if (property.type === 'string' && property.format && property.format === 'markdown') {
    return 'markdown';
  }

  if (property.type === 'string' && property.format && property.format === 'image') {
    return 'image';
  }

  if (property.type === 'string' && property.format && property.format === 'id') {
    return 'id';
  }

  return mapping[property.type as TypeName];
}

function componentsEqual(componentOne: IStaticCmsField, componentTwo: IStaticCmsField): boolean {
  return componentOne.name === componentTwo.name;
}

function processObject({
  name,
  description,
  subSchema,
  fields,
  classification
}: IProcessInterface<IStaticCmsField>): IProcessFnResult<IStaticCmsField> {
  const field: IStaticCmsField = {
    label: toPascalCase(name),
    name,
    widget: basicTypeMapping(subSchema),
    fields: fields,
    collapsed: true
  };

  // TODO this is suspect, should expect an object here when in processObject
  if (subSchema.default) field.default = subSchema.default as string;

  if (description) field.hint = description;

  field.required = subSchema.required?.includes(name) || false;

  if (classification && classification === 'template') {
    return { field, templates: [field] };
  } else if (classification && classification === 'global') {
    return { field, globals: [field] };
  }
  return { field };
}

function processRef({
  name,
  description,
  subSchema,
  fields
}: IProcessInterface<IStaticCmsField>): IProcessFnResult<IStaticCmsField> {
  const field: IStaticCmsField = {
    label: toPascalCase(name),
    name,
    widget: basicTypeMapping(subSchema),
    fields: fields,
    collapsed: true
  };

  // TODO this is suspect, should expect an object here when in processObject
  if (subSchema.default) field.default = subSchema.default as string;

  if (description) field.hint = description;

  field.required = subSchema.required?.includes(name) || false;

  return { field };
}

function processRefArray({
  name,
  description,
  rootSchema,
  fields
}: IProcessInterface<IStaticCmsField>): IProcessFnResult<IStaticCmsField> {
  const field: IStaticCmsField = {
    name,
    widget: 'list',
    types: fields
  };

  if (description) field.hint = description;

  field.required = rootSchema.required?.includes(name) || false;

  return { field };
}

function processObjectArray({
  name,
  description,
  subSchema,
  rootSchema,
  fields
}: IProcessInterface<IStaticCmsField>): IProcessFnResult<IStaticCmsField> {
  const field: IStaticCmsField = {
    name,
    widget: 'list',
    types: fields
  };

  // TODO this is suspect, should expect an object here when in processObject
  if (rootSchema.default) field.default = subSchema.default as string;

  if (description) field.hint = description;

  field.required = rootSchema.required?.includes(name) || false;

  return { field };
}

function processArray({
  name,
  description,
  subSchema,
  rootSchema,
  arrayField
}: IProcessInterface<IStaticCmsField>): IProcessFnResult<IStaticCmsField> {
  const field: IStaticCmsField = {
    label: toPascalCase(name),
    name,
    widget: 'list'
  };

  // TODO this is suspect, should expect an object here when in processObject
  if (rootSchema.default) field.default = subSchema.default as string;

  if (description) field.hint = description;

  field.required = rootSchema.required?.includes(name) || false;

  if (arrayField && arrayField.fields) field.fields = arrayField.fields;

  return { field };
}

function processEnum({
  name,
  description,
  subSchema,
  options
}: IProcessInterface<IStaticCmsField>): IProcessFnResult<IStaticCmsField> {
  const field: IStaticCmsField = {
    label: toPascalCase(name),
    name,
    widget: 'select',
    options
  };

  if (subSchema.default) field.default = safeEnumKey(subSchema.default as string);

  if (description) field.hint = description;

  field.required = subSchema.required?.includes(name) || false;

  return { field };
}

function processConst({ subSchema }: IProcessInterface<IStaticCmsField>): IProcessFnResult<IStaticCmsField> {
  return getInternalTypeDefinition(subSchema.const as string);
}

function processBasic({
  name,
  description,
  subSchema,
  rootSchema
}: IProcessInterface<IStaticCmsField>): IProcessFnResult<IStaticCmsField> {
  const widget = basicTypeMapping(subSchema);

  const field: IStaticCmsField = {
    label: toPascalCase(name),
    name,
    widget
  };

  if (widget === 'number') field.valueType = 'int';

  if (subSchema.default) field.default = subSchema.default as string;

  if (description) field.hint = description;

  field.required = rootSchema.required?.includes(name) || false;

  return { field };
}

function getInternalTypeDefinition(
  type: string
): IProcessFnResult<IStaticCmsField, IStaticCmsField, IStaticCmsField> {
  return {
    field: {
      label: toPascalCase(typeResolutionField),
      name: typeResolutionField,
      widget: 'hidden',
      description: 'Internal type for interface resolution',
      default: type
    }
  };
}

function buildDescription(d: JSONSchema.Interface): string {
  return d.description || d.title || '';
}
