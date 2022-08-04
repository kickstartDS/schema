import { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import { getSchemasForIds, toPascalCase } from '@kickstartds/jsonschema-utils/dist/helpers';
import { getSchemaReducer, processFn } from '@kickstartds/jsonschema2netlifycms/build/schemaReducer';
import { safeEnumKey } from '@kickstartds/jsonschema2netlifycms/build/safeEnumKey';
import { cleanFieldName } from '@kickstartds/jsonschema2graphql/build/dehashing';

import { TinaCloudSchema, TinaFieldInner, ObjectType } from '@tinacms/schema-tools';

import { ConvertParams } from './@types';
import { createConfig } from './createConfig';
import { parseMDX } from './parse';

// TODO correct parameter documentation
/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export const convert = ({
  schemaIds,
  ajv,
  schemaPost,
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
        schemaPost,
      }
    ), []);

export { TinaCloudSchema, createConfig };

const processObject: processFn<TinaFieldInner<false>> = ({
  name,
  description,
  subSchema,
  fields,
}) => {
  const field: ObjectType<false> = {
    name: name.replace(/-/g, '_'),
    type: 'object',
    label: subSchema.title || toPascalCase(cleanFieldName(name)),
    fields,
  }

  if (subSchema.default) {
    field.ui = field.ui || {};
    field.ui.defaultItem = subSchema.default;
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
  subSchema,
  // rootSchema,
  fields,
}) => {
  // TODO should try to get by without that forced type
  const field: ObjectType<false> = {
    name: name.replace(/-/g, '_'),
    list: true,
    type: 'object',
    label: subSchema.title || toPascalCase(cleanFieldName(name)),
    templates: (fields as {
      label: string;
      name: string;
      fields: TinaFieldInner<false>[];
    }[]).map(({label, ...rest}) => {
      return {
        ...rest,
        label: toPascalCase(cleanFieldName(label)),
      }
    }),
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
  subSchema,
  // rootSchema,
  fields,
}) => {
  // TODO should try to get by without that forced type
  const field: ObjectType<false> = {
    name: name.replace(/-/g, '_'),
    list: true,
    type: 'object',
    label: subSchema.title || toPascalCase(cleanFieldName(name)),
    templates: (fields as {
      label: string;
      name: string;
      fields: TinaFieldInner<false>[];
    }[]).map(({label, ...rest}) => {
      return {
        ...rest,
        label: toPascalCase(cleanFieldName(label)),
      }
    }),
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
  subSchema,
  // rootSchema,
  arrayField,
}) => {
  const field: ObjectType<false> = {
    name: name.replace(/-/g, '_'),
    list: true,
    type: 'object',
    label: subSchema.title || toPascalCase(cleanFieldName(name)),
    templates: []
  };

  // TODO should try to get by without that forced type
  if (arrayField) {
    const { label, ...rest } = arrayField;

    field.templates.push({
      label: toPascalCase(cleanFieldName(label)),
      ...rest
    } as {
      label: string;
      name: string;
      fields: TinaFieldInner<false>[];
    });
  }

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
  parentSchema,
}) => {
  const field: TinaFieldInner<false> = {
    name: name.replace(/-/g, '_'),
    type: 'string',
    list: false,
    label: subSchema.title || toPascalCase(cleanFieldName(name)),
    options,
  };

  if (subSchema.default) {
    field.ui = field.ui || {};
    field.ui.defaultValue = safeEnumKey(subSchema.default as string)
  };

  if (description)
    field.description = description;

  if (parentSchema.required?.includes(cleanFieldName(name)))
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
  parentSchema,
}) => {
  return scalarMapping(subSchema, name, description, parentSchema);
};

const typeResolutionField = 'type';
const getInternalTypeDefinition = (type: string): TinaFieldInner<false> => {
  const field: TinaFieldInner<false> = {
    name: typeResolutionField,
    description: 'Internal type for interface resolution',
    type: 'string',
    ui: {
      defaultValue: type,
    }
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
  description: string,
  parentSchema: JSONSchema7,
) : TinaFieldInner<false> => {
  if (property.type === 'string' && property.enum && property.enum.length) {
    return {
      label: property.title || toPascalCase(cleanFieldName(propertyName)),
      description,
      list: true,
      name: propertyName.replace('-', '_'),
      options: property.enum.map((value) => value as string) || [],
      type: 'string',
      required: parentSchema.required?.includes(cleanFieldName(propertyName)),
      ui: {
        defaultValue: [property.default as string],
      },
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'markdown'
  ) {
    return {
      label: property.title || toPascalCase(cleanFieldName(propertyName)),
      description,
      name: propertyName.replace('-', '_'),
      type: 'rich-text',
      required: parentSchema.required?.includes(cleanFieldName(propertyName)),
      ui: {
        defaultValue: parseMDX(
          property.default as string,
          { type: 'rich-text', name: '' },
          { useRelativeMedia: true },
          { collections: [] }
        ),
      },
    }
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'image'
  ) {
    return {
      label: property.title || toPascalCase(cleanFieldName(propertyName)),
      description,
      name: propertyName.replace('-', '_'),
      type: 'image',
      required: parentSchema.required?.includes(cleanFieldName(propertyName)),
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'date'
  ) {
    return {
      label: property.title || toPascalCase(cleanFieldName(propertyName)),
      description,
      name: propertyName.replace('-', '_'),
      type: 'string',
      required: parentSchema.required?.includes(cleanFieldName(propertyName)),
      ui: {
        dateFormat: 'YYYY MM DD',
        defaultValue: property.default as string,
      },
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'id'
  ) {
    return {
      label: property.title || toPascalCase(cleanFieldName(propertyName)),
      description,
      name: propertyName.replace('-', '_'),
      type: 'string',
      list: false,
      required: parentSchema.required?.includes(cleanFieldName(propertyName)),
      ui: {
        defaultValue: property.default as string
      },
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'color'
  ) {
    return {
      label: property.title || toPascalCase(cleanFieldName(propertyName)),
      description,
      name: propertyName.replace('-', '_'),
      type: 'string',
      list: false,
      ui: {
        component: 'color',
        defaultValue: property.default as string
      },
    };
  }

  if (property.type === 'string') {
    return {
      label: property.title || toPascalCase(cleanFieldName(propertyName)),
      description,
      name: propertyName.replace('-', '_'),
      type: 'string',
      list: false,
      required: parentSchema.required?.includes(cleanFieldName(propertyName)),
      ui: {
        defaultValue: property.default as string
      },
    };
  }

  if (property.type === 'integer' || property.type === 'number') {
    return {
      label: property.title || toPascalCase(cleanFieldName(propertyName)),
      description,
      name: propertyName.replace('-', '_'),
      type: 'number',
      required: parentSchema.required?.includes(cleanFieldName(propertyName)),
      ui: {
        defaultValue: property.default as number
      },
    };
  }

  if (property.type === 'boolean') {
    return {
      label: property.title || toPascalCase(cleanFieldName(propertyName)),
      description,
      name: propertyName.replace('-', '_'),
      type: 'boolean',
      required: parentSchema.required?.includes(cleanFieldName(propertyName)),
      ui: {
        defaultValue: property.default as boolean
      },
    }
  }

  // TODO handle this better, catch-all so something is returned
  return {
    label: property.title || toPascalCase(cleanFieldName(propertyName)),
    description,
    name: propertyName.replace('-', '_'),
    type: 'boolean',
    required: parentSchema.required?.includes(cleanFieldName(propertyName)),
    ui: {
      defaultValue: property.default as boolean
    },
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
