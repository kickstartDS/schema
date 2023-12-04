import {
  getSchemasForIds,
  toPascalCase,
  getSchemaReducer,
  IProcessInterface,
  safeEnumKey,
  IReducerResult,
  IProcessFnMultipleResult,
  IProcessFnResult,
  IConvertParams
} from '@kickstartds/jsonschema-utils';
import { type JSONSchema, TypeName } from 'json-schema-typed/draft-07';

import { INetlifyCmsField, INetlifyCmsConfig } from './@types/index.js';
import { createConfig } from './createConfig.js';

const typeResolutionField: string = 'type';

export { INetlifyCmsConfig, createConfig };

// TODO check the generated NetlifyCmsField properties for all elements:
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
}: IConvertParams): IReducerResult<INetlifyCmsField> {
  return getSchemasForIds(schemaIds, ajv).reduce(
    getSchemaReducer<INetlifyCmsField>({
      ajv,
      typeResolutionField,
      buildDescription,
      safeEnumKey,
      basicTypeMapping,
      processComponent,
      processObject,
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

function processComponent({
  name,
  description,
  subSchema,
  fields
}: IProcessInterface<INetlifyCmsField>): IReducerResult<INetlifyCmsField> {
  if (!fields) throw new Error('Missing fields on component to process');

  const objects: INetlifyCmsField[] = [];
  objects.push({
    label: toPascalCase(name),
    name,
    widget: basicTypeMapping(subSchema),
    fields: fields,
    collapsed: true,
    // TODO this is suspect, should expect an object here when in processObject
    default: subSchema?.default as string,
    hint: description,
    required: subSchema.required?.includes(name) || false
  });

  return { components: objects, templates: [], globals: [] };
}

function processObject({
  name,
  description,
  subSchema,
  fields
}: IProcessInterface<INetlifyCmsField>): IProcessFnMultipleResult<INetlifyCmsField> {
  const field: INetlifyCmsField = {
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
}: IProcessInterface<INetlifyCmsField>): IProcessFnResult<INetlifyCmsField> {
  const field: INetlifyCmsField = {
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
}: IProcessInterface<INetlifyCmsField>): IProcessFnResult<INetlifyCmsField> {
  const field: INetlifyCmsField = {
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
}: IProcessInterface<INetlifyCmsField>): IProcessFnResult<INetlifyCmsField> {
  const field: INetlifyCmsField = {
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
}: IProcessInterface<INetlifyCmsField>): IProcessFnResult<INetlifyCmsField> {
  const field: INetlifyCmsField = {
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

function processConst({
  subSchema
}: IProcessInterface<INetlifyCmsField>): IProcessFnResult<INetlifyCmsField> {
  return getInternalTypeDefinition(subSchema.const as string);
}

function processBasic({
  name,
  description,
  subSchema,
  rootSchema
}: IProcessInterface<INetlifyCmsField>): IProcessFnResult<INetlifyCmsField> {
  const widget = basicTypeMapping(subSchema);

  const field: INetlifyCmsField = {
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
): IProcessFnResult<INetlifyCmsField, INetlifyCmsField, INetlifyCmsField> {
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
