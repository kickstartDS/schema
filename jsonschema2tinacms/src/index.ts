import { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import { getSchemasForIds, toPascalCase } from '@kickstartds/jsonschema-utils/dist/helpers';
import { getSchemaReducer, processFn } from '@kickstartds/jsonschema2netlifycms/build/schemaReducer';
import { safeEnumKey } from '@kickstartds/jsonschema2netlifycms/build/safeEnumKey';

import { TinaCloudSchema, TinaFieldInner, ObjectType } from '@tinacms/schema-tools';

import { ConvertParams } from './@types';
import { createConfig } from './createConfig';

// TODO correct parameter documentation
/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export const convert = ({
  schemaIds,
  ajv,
}: ConvertParams): TinaFieldInner<false>[] =>
  getSchemasForIds(schemaIds, ajv)
    .reduce(getSchemaReducer<TinaFieldInner<false>>(
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
      }
    ), []);

export { TinaCloudSchema, createConfig };

const processObject: processFn<TinaFieldInner<false>> = ({
  name,
  description,
  // subSchema,
  fields,
}) => {
  const field: ObjectType<false> = {
    name: name.replace('-', '_'),
    type: 'object',
    label: toPascalCase(name),
    fields,
  }

  if (description)
    field.description = description;

  // TODO fix required, typings used seem off for this currently
  // if (subSchema.required?.includes(name))
  //   field.required = true;

  return field;
};

const processRefArray: processFn<TinaFieldInner<false>> = ({
  name,
  description,
  // rootSchema,
  fields,
}) => {
  // TODO should try to get by without that forced type
  const field: ObjectType<false> = {
    name: name.replace('-', '_'),
    list: true,
    type: 'object',
    label: toPascalCase(name),
    templates: fields as {
      label: string;
      name: string;
      fields: TinaFieldInner<false>[];
    }[],
  };

  if (description)
    field.description = description;

  // TODO fix required, typings used seem off for this currently
  // if (rootSchema.required?.includes(name))
  //   field.required = true;

  return field;
};

const processObjectArray: processFn<TinaFieldInner<false>> = ({
  name,
  description,
  // rootSchema,
  fields,
}) => {
  // TODO should try to get by without that forced type
  const field: ObjectType<false> = {
    name: name.replace('-', '_'),
    list: true,
    type: 'object',
    label: toPascalCase(name),
    templates: fields as {
      label: string;
      name: string;
      fields: TinaFieldInner<false>[];
    }[],
  };

  if (description)
    field.description = description;

  // TODO fix required, typings used seem off for this currently
  // if (rootSchema.required?.includes(name))
  //   field.required = true;

  return field;
};

const processArray: processFn<TinaFieldInner<false>> = ({
  name,
  description,
  // rootSchema,
  arrayField,
}) => {
  const field: ObjectType<false> = {
    name: name.replace('-', '_'),
    list: true,
    type: 'object',
    label: toPascalCase(name),
    templates: []
  };

  // TODO should try to get by without that forced type
  if (arrayField)
    field.templates.push(arrayField as {
      label: string;
      name: string;
      fields: TinaFieldInner<false>[];
    });

  if (description)
    field.description = description;

  // TODO fix required, typings used seem off for this currently
  // if (rootSchema.required?.includes(name))
  //   field.required = true;

  return field;
};

const processEnum: processFn<TinaFieldInner<false>> = ({
  name,
  description,
  subSchema,
  options,
}) => {
  const field: TinaFieldInner<false> = {
    name: name.replace('-', '_'),
    type: 'string',
    list: false,
    label: toPascalCase(name),
    options,
  };

  if (description)
    field.description = description;

  if (subSchema.required?.includes(name))
    field.required = true;

  return field;
};

const processConst: processFn<TinaFieldInner<false>> = ({
  subSchema,
}) => {
  return getInternalTypeDefinition(subSchema.const as string);
};

const processBasic: processFn<TinaFieldInner<false>> = ({
  name,
  description,
  subSchema,
}) => {
  return scalarMapping(subSchema, name, description);
};

const typeResolutionField = 'type';
const getInternalTypeDefinition = (type: string): TinaFieldInner<false> => {
  const field: TinaFieldInner<false> = {
    name: typeResolutionField,
    description: 'Internal type for interface resolution',
    type: 'string',
  };

  return field;
};

const basicMapping = (property: JSONSchema7) : string => {
  if (property.type === 'string' && property.enum && property.enum.length) {
    return 'string';
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'markdown'
  ) {
    return 'rich-text';
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
    property.format === 'date'
  ) {
    return 'string';
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'id'
  ) {
    return 'string';
  }

  if (property.type === 'string') {
    return 'string';
  }

  if (property.type === 'integer' || property.type === 'number') {
    return 'number';
  }

  if (property.type === 'boolean') {
    return 'boolean';
  }

  // TODO re-check this, untested
  return mapping[property.type as JSONSchema7TypeName];
};

const scalarMapping = (
  property: JSONSchema7,
  propertyName: string,
  description: string
) : TinaFieldInner<false> => {
  if (property.type === 'string' && property.enum && property.enum.length) {
    return {
      label: propertyName,
      description,
      list: true,
      name: propertyName.replace('-', '_'),
      options: property.enum.map((value) => value as string) || [],
      type: 'string',
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'markdown'
  ) {
    return {
      label: propertyName,
      description,
      name: propertyName.replace('-', '_'),
      type: 'rich-text',
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'image'
  ) {
    return {
      label: propertyName,
      description,
      name: propertyName.replace('-', '_'),
      type: 'image',
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'date'
  ) {
    return {
      label: propertyName,
      description,
      name: propertyName.replace('-', '_'),
      type: 'string',
      ui: {
        dateFormat: 'YYYY MM DD',
      }
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'id'
  ) {
    return {
      label: propertyName,
      description,
      name: propertyName.replace('-', '_'),
      type: 'string',
      list: false,
    };
  }

  if (property.type === 'string') {
    return {
      label: propertyName,
      description,
      name: propertyName.replace('-', '_'),
      type: 'string',
      list: false,
    };
  }

  if (property.type === 'integer' || property.type === 'number') {
    return {
      label: propertyName,
      description,
      name: propertyName.replace('-', '_'),
      type: 'number',
    };
  }

  if (property.type === 'boolean') {
    return {
      label: propertyName,
      description,
      name: propertyName.replace('-', '_'),
      type: 'boolean',
    }
  }

  // TODO handle this better, catch-all so something is returned
  return {
    label: propertyName,
    description,
    name: propertyName.replace('-', '_'),
    type: 'boolean',
  }

  // console.log('unsupported property in scalarMapping', property);
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
