import { ConvertParams, NetlifyCmsField, NetlifyCmsConfig } from './@types';
import { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import { getSchemasForIds, toPascalCase } from '@kickstartds/jsonschema-utils/dist/helpers';

import { getSchemaReducer, processFn } from './schemaReducer';
import { createConfig } from './createConfig';
import { safeEnumKey } from './safeEnumKey';

// TODO check the generated NetlifyCmsField properties for all elements:
// * required -> this is not functional yet... needs to be evaluated intelligently,
//      because of schema nesting (schema > array > allOf > $ref > object, etc)
// * hint -> may be affected by the same challenge as `required`
// TODO move `getSchemaReducer`, `processFn` and `safeEnumKey` to `jsonschema-utils`
// TODO correct parameter documentation
/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export const convert = ({
  schemaIds,
  ajv,
  schemaPost,
}: ConvertParams): NetlifyCmsField[] =>
  getSchemasForIds(schemaIds, ajv)
    .reduce(getSchemaReducer<NetlifyCmsField>(
      {
        ajv,
        typeResolutionField,
        buildDescription,
        safeEnumKey,
        basicMapping,
        processObject,
        processRefArray,
        processObjectArray,
        processArray,
        processEnum,
        processConst,
        processBasic,
        schemaPost,
      }
    ), []);

export { NetlifyCmsConfig, createConfig };

const processObject: processFn<NetlifyCmsField> = ({
  name,
  description,
  subSchema,
  fields,
}) => {
  const field: NetlifyCmsField = {
    label: toPascalCase(name),
    name,
    widget: basicMapping(subSchema),
    fields: fields,
    collapsed: true,
  };

  // TODO this is suspect, should expect an object here when in processObject
  if (subSchema.default)
    field.default = subSchema.default as string;

  if (description)
    field.hint = description;

  field.required = subSchema.required?.includes(name) || false;

  return field;
};

const processRefArray: processFn<NetlifyCmsField> = ({
  name,
  description,
  rootSchema,
  fields,
}) => {
  const field: NetlifyCmsField = {
    name,
    widget: 'list',
    types: fields
  };

  if (description)
    field.hint = description;

  field.required = rootSchema.required?.includes(name) || false;

  return field;
};

const processObjectArray: processFn<NetlifyCmsField> = ({
  name,
  description,
  subSchema,
  rootSchema,
  fields,
}) => {
  const field: NetlifyCmsField = {
    name,
    widget: 'list',
    types: fields,
  };

  // TODO this is suspect, should expect an object here when in processObject
  if (rootSchema.default)
    field.default = subSchema.default as string;

  if (description)
    field.hint = description;

  field.required = rootSchema.required?.includes(name) || false;

  return field;
};

const processArray: processFn<NetlifyCmsField> = ({
  name,
  description,
  subSchema,
  rootSchema,
  arrayField,
}) => {
  const field: NetlifyCmsField = {
    label: toPascalCase(name),
    name,
    widget: 'list',
  };

  // TODO this is suspect, should expect an object here when in processObject
  if (rootSchema.default)
    field.default = subSchema.default as string;

  if (description)
    field.hint = description;

  field.required = rootSchema.required?.includes(name) || false;

  if (arrayField && arrayField.fields)
    field.fields = arrayField.fields;

  return field;
};

const processEnum: processFn<NetlifyCmsField> = ({
  name,
  description,
  subSchema,
  options,
}) => {
  const field: NetlifyCmsField = {
    label: toPascalCase(name),
    name,
    widget: 'select',
    options,
  }

  if (subSchema.default)
    field.default = safeEnumKey(subSchema.default as string);

  if (description)
    field.hint = description;

  field.required = subSchema.required?.includes(name) || false;

  return field;
};

const processConst: processFn<NetlifyCmsField> = ({
  subSchema,
}) => {
  return getInternalTypeDefinition(subSchema.const as string);
};

const processBasic: processFn<NetlifyCmsField> = ({
  name,
  description,
  subSchema,
  rootSchema,
}) => {
  const widget = basicMapping(subSchema);

  const field: NetlifyCmsField = {
    label: toPascalCase(name),
    name,
    widget,
  };

  if (widget === 'number')
    field.valueType = 'int';

  if (subSchema.default)
    field.default = subSchema.default as string;

  if (description)
    field.hint = description;

  field.required = rootSchema.required?.includes(name) || false;

  return field;
};

const typeResolutionField = 'type';
const getInternalTypeDefinition = (type: string): NetlifyCmsField => {
  return {
    label: toPascalCase(typeResolutionField),
    name: typeResolutionField,
    widget: 'hidden',
    description: 'Internal type for interface resolution',
    default: type,
  }
};

const basicMapping = (property: JSONSchema7) : string => {
  if (property.type === 'string' && property.enum && property.enum.length) {
    return 'select';
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'markdown'
  ) {
    return 'markdown';
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'image'
  ) {
    return 'image';
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'id'
  ) {
    return 'id';
  }

  return mapping[property.type as JSONSchema7TypeName];
};

const buildDescription = (d: any): string | undefined =>
  d.description || d.title || undefined;

interface TypeMapping {
  boolean: string;
  string: string;
  integer: string;
  array: string;
  object: string;
};

const mapping: TypeMapping = {
  boolean: 'boolean',
  string: 'string',
  integer: 'number',
  array: 'list',
  object: 'object',
};
