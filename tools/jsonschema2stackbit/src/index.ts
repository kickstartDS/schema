/* eslint-disable @typescript-eslint/naming-convention */
import {
  getSchemasForIds,
  toPascalCase,
  getSchemaReducer,
  IProcessInterface,
  safeEnumKey,
  IReducerResult,
  IProcessFnMultipleResult,
  IProcessFnResult
} from '@kickstartds/jsonschema-utils';
import {
  Field,
  FieldBasicProps,
  FieldEnum,
  FieldList,
  FieldObject,
  FieldText,
  ObjectModel,
  PageModel
} from '@stackbit/types';
import { type JSONSchema, TypeName } from 'json-schema-typed/draft-07';

import { GenericType, IConvertParams, ITypeMapping } from './@types/index.js';
export * from './@types/index.js';

const typeResolutionField: string = 'type';

/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export function convert({
  schemaIds,
  ajv,
  schemaPost
}: IConvertParams): IReducerResult<ObjectModel, PageModel> {
  const reduced = getSchemasForIds(schemaIds, ajv).reduce(
    getSchemaReducer<Field, ObjectModel, PageModel>({
      ajv,
      typeResolutionField,
      buildDescription,
      safeEnumKey,
      basicMapping,
      processComponent,
      processObject,
      processRefArray,
      processObjectArray,
      processArray,
      processEnum,
      processConst,
      processBasic,
      schemaPost,
      isField,
      isComponent,
      isTemplate
    }),
    { components: [], templates: [] }
  );

  return reduced;
}

const mapping: ITypeMapping = {
  [TypeName.String]: 'text',
  [TypeName.Integer]: 'number',
  [TypeName.Boolean]: 'boolean',
  [TypeName.Array]: 'list',
  [TypeName.Object]: 'object',
  [TypeName.Null]: 'text',
  [TypeName.Number]: 'number'
};

// TODO this is incomplete
function isField(object: Field | ObjectModel | PageModel): object is Field {
  return (object as Field).type !== undefined;
}

function isComponent(object: Field | ObjectModel | PageModel): object is ObjectModel {
  return (object as ObjectModel).type === 'object';
}

function isTemplate(object: Field | ObjectModel | PageModel): object is PageModel {
  return (object as PageModel).type === 'page';
}

function basicMapping(property: JSONSchema.Interface): GenericType {
  if (property.type === 'string' && property.enum && property.enum.length) {
    return 'enum';
  }

  if (property.type === 'string' && property.format && property.format === 'markdown') {
    return 'markdown';
  }

  if (property.type === 'string' && property.format && property.format === 'image') {
    return 'image';
  }

  if (property.type === 'string' && property.format && property.format === 'id') {
    return 'number';
  }

  return mapping[property.type as TypeName];
}

function processComponent({
  name,
  description,
  fields
}: IProcessInterface<Field>): IReducerResult<ObjectModel, PageModel> {
  if (!fields) throw new Error('Missing fields on component to process');

  const objects: ObjectModel[] = [];
  objects.push({
    name: name.replace('-', '_'),
    label: toPascalCase(name),
    description,
    type: 'object',
    fields: fields.reduce<Field[]>((fields, field) => {
      fields.push(field);
      return fields;
    }, [])
  });
  return { components: objects, templates: [] };
}

function processObject({
  name,
  description,
  fields
}: IProcessInterface<Field>): IProcessFnMultipleResult<Field, ObjectModel, PageModel> {
  if (!fields) throw new Error('Missing fields on object to process');

  const field: FieldObject = {
    name,
    label: toPascalCase(name),
    description,
    type: 'object',
    fields: fields.reduce<Field[]>((fields, field) => {
      fields.push(field);
      return fields;
    }, [])
  };

  return { field, components: [], templates: [] };
}

function processRefArray({
  name,
  description,
  rootSchema,
  fields
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel> {
  if (!fields) throw new Error('Missing fields on ref array to process');

  const field: FieldList = {
    name,
    type: 'list',
    items: {
      type: 'model',
      models: fields?.reduce<string[]>((models, field) => {
        models.push(field.name);
        return models;
      }, [])
    }
  };

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return { field, components: [], templates: [] };
}

function processObjectArray({
  name,
  description,
  subSchema,
  rootSchema,
  fields
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel> {
  if (!fields) throw new Error('Missing fields on object array to process');

  const objects: ObjectModel[] = [];
  for (const field of fields) {
    if (field.type === 'object') {
      objects.push({
        name: field.name,
        label: toPascalCase(field.name),
        description,
        type: 'object',
        fields: field.fields
      });
    }
  }

  const field: FieldList = {
    name,
    type: 'list',
    items: {
      type: 'model',
      models: fields?.reduce<string[]>((models, field) => {
        models.push(field.name);
        return models;
      }, [])
    }
  };

  // TODO this is suspect, should expect an object here when in processObject
  if (rootSchema.default) field.default = subSchema.default as string;

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return { field, components: objects, templates: [] };
}

function processArray({
  name,
  // description,
  // subSchema,
  // rootSchema,
  arrayField
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel> {
  if (!arrayField || !arrayField.type) throw new Error('Missing type in array field');
  if (arrayField.type === 'list') throw new Error('Error type list');
  if (arrayField.type === 'number') throw new Error('Error type number');
  if (arrayField.type === 'enum') throw new Error('Error type enum');
  if (arrayField.type === 'image') throw new Error('Error type image');
  if (arrayField.type === 'model') throw new Error('Error type model');
  if (arrayField.type === 'reference') throw new Error('Error type reference');
  if (arrayField.type === 'style') throw new Error('Error type style');
  if (arrayField.type === 'cross-reference') throw new Error('Error type cross-reference');

  if (arrayField.type === 'object') {
    const { name, label, description, ...listField } = arrayField;
    const field: FieldList = {
      name,
      label,
      description,
      type: 'list',
      items: listField
    };

    return { field, components: [], templates: [] };
  } else {
    const items: FieldBasicProps = {
      type: arrayField.type
    };

    const field: FieldList = {
      name,
      type: 'list',
      items
    };

    return { field, components: [], templates: [] };
  }
}

function processEnum({
  name,
  description,
  subSchema,
  options
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel> {
  const field: FieldEnum = {
    name,
    type: 'enum',
    options: []
  };

  if (subSchema.default) field.default = safeEnumKey(subSchema.default as string);

  if (description) field.description = description;

  if (options) {
    field.options = options;
  }

  field.required = subSchema.required?.includes(name) || false;

  return { field, components: [], templates: [] };
}

function processConst({
  subSchema
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel> {
  return { field: getInternalTypeDefinition(subSchema.const as string), components: [], templates: [] };
}

function processBasic({
  name,
  description,
  subSchema,
  rootSchema
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel> {
  // const type = basicMapping(subSchema);

  const field: Field = {
    name,
    type: 'string'
  };

  if (subSchema.default) field.default = subSchema.default as string;

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return { field, components: [], templates: [] };
}

function getInternalTypeDefinition(type: string): FieldText {
  return {
    name: toPascalCase(typeResolutionField),
    type: 'text',
    description: 'Internal type for interface resolution',
    default: type
  };
}

function buildDescription(d: JSONSchema.Interface): string {
  return d.description || d.title || '';
}
