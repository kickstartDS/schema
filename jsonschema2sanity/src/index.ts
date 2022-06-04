import { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import { getSchemasForIds, toPascalCase } from '@kickstartds/jsonschema-utils/dist/helpers';
import { getSchemaReducer, processFn } from '@kickstartds/jsonschema2netlifycms/build/schemaReducer';
import { safeEnumKey } from '@kickstartds/jsonschema2netlifycms/build/safeEnumKey';

import { ConvertParams, Field, ObjectField, ArrayField, StringField, GetSchema } from './@types';

// TODO move `getSchemaReducer`, `processFn` and `safeEnumKey` to `jsonschema-utils`
// TODO correct parameter documentation
/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export const convert = ({
  schemaIds,
  ajv,
}: ConvertParams): Field[] => 
  getSchemasForIds(schemaIds, ajv)
    .reduce(getSchemaReducer<Field>(
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

const processObject: processFn<Field> = ({
  name,
  description,
  subSchema,
  fields,
}) => {
  const field: ObjectField = {
    name,
    type: 'object',
    title: toPascalCase(name),
    fields: fields || [],
  }

  if (description)
    field.description = description;
    
  if (subSchema.default)
    field.initialValue = subSchema.default as string;
  
  if (subSchema.required?.includes(name))
    field.validation = (Rule) => Rule.required();

  return field; 
};

const processRefArray: processFn<Field> = ({
  name,
  description,
  rootSchema,
  fields,
}) => {
  const field: ArrayField = {
    name,
    type: 'array',
    title: toPascalCase(name),
    of: fields || [],
  };
  
  if (description)
    field.description = description;

  if (rootSchema.required?.includes(name))
    field.validation = (Rule) => Rule.required();

  return field;
};

const processObjectArray: processFn<Field> = ({
  name,
  description,
  subSchema,
  rootSchema,
  fields,
}) => {
  const field: ArrayField = {
    name,
    type: 'array',
    title: toPascalCase(name),
    of: fields || [],
  };

  if (rootSchema.default)
    field.initialValue = subSchema.default as string;
  
  if (description)
    field.description = description;

  if (rootSchema.required?.includes(name))
    field.validation = (Rule) => Rule.required();

  return field;
};

const processArray: processFn<Field> = ({
  name,
  description,
  subSchema,
  rootSchema,
  arrayField,
}) => {
  const field: ArrayField = {
    name,
    type: 'array',
    title: toPascalCase(name),
    of: []
  };

  if (arrayField)
    field.of.push(arrayField);

  if (rootSchema.default)
    field.initialValue = subSchema.default as string;

  if (description)
    field.description = description;

  if (rootSchema.required?.includes(name))
    field.validation = (Rule) => Rule.required();

  return field;
};

const processEnum: processFn<Field> = ({
  name,
  description,
  subSchema,
  options,
}) => {
  const field: StringField = {
    name,
    type: 'string',
    title: toPascalCase(name),
    options: {
      list: options?.map((option) => { 
        return { title: option.label, value: option.value };
      }) || []
    },
  };

  if (subSchema.const) {
    field.initialValue = subSchema.const;
    field.hidden = true;
    field.readOnly = true;
  }

  if (description)
    field.description = description;

  if (subSchema.required?.includes(name))
    field.validation = (Rule) => Rule.required();
  
  return field;
};

const processConst: processFn<Field> = ({
  subSchema,
}) => {
  return getInternalTypeDefinition(subSchema.const as string);
};

const processBasic: processFn<Field> = ({
  name,
  description,
  subSchema,
  rootSchema,
}) => {
  const field = widgetMapping(subSchema, name, toPascalCase(name));
  
  if (description)
    field.description = description;

  if (rootSchema.required?.includes(name))
    field.validation = (Rule) => Rule.required();

  return field;
};

const typeResolutionField = 'type';
const getInternalTypeDefinition = (type: string): StringField => {
  const field: StringField = {
    title: toPascalCase(typeResolutionField),
    name: typeResolutionField,
    hidden: true,
    readOnly: true,
    description: 'Internal type for interface resolution',
    initialValue: type,
    type: "string",
  };

  return field;
};

const widgetMapping = (property: JSONSchema7, name: string, title: string): Field => {
  // const field: Field = {
  //   name,
  //   type: widget,
  //   title: toPascalCase(name),
  // };

  if (property.const) {
    return {
      name,
      type: 'string',
      title,
      initialValue: property.const,
      hidden: true,
      readOnly: true,
    }
  }

  if (property.type === 'string' && property.enum && property.enum.length) {
    return {
      name,
      type: 'string',
      title,
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'markdown'
  ) {
    return {
      name,
      type: 'array',
      of: [{ type: "block" }],
      title,
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'image'
  ) {
    return {
      name,
      type: 'image',
      options: {
        hotspot: true,
      },
      title,
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'id'
  ) {
    return {
      name,
      type: 'string',
      title,
    };
  }

  return {
    name,
    type: mapping[property.type as JSONSchema7TypeName],
    title,
  };
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