import {
  getSchemasForIds,
  getSchemaForId,
  toPascalCase,
  getSchemaReducer,
  IProcessInterface,
  safeEnumKey
} from '@kickstartds/jsonschema-utils';
import { type JSONSchema, TypeName } from 'json-schema-typed/draft-07';

import {
  GenericType,
  IConvertParams,
  ITypeMapping,
  StoryblokElement,
  IStoryblokSchemaElement
} from './@types/index.js';
import { createConfig } from './createConfig.js';

const typeResolutionField: string = 'type';

/**
 *  # TODO
 *
 *  - [ ] re-add configuration part, including types
 *  - [ ] add `pos` handling to get sensible order of fields
 *  - [ ] check required status `pos`, `max_length`, `required`, `default_value`, `description` in types
 */

export { createConfig };

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
export function convert({ ajv, schemaPost }: IConvertParams): StoryblokElement[] {
  const sectionSchema = getSchemaForId('http://kickstartds.com/section.schema.json', ajv);
  const contentSchemaIds = (
    (sectionSchema?.properties?.content as JSONSchema.Array)?.items as JSONSchema.Interface
  )?.anyOf?.map((anyOfSchema) => (anyOfSchema as JSONSchema.Object).$ref as string);

  if (!contentSchemaIds) {
    throw new Error("Shouldn't happen");
  }

  return getSchemasForIds(contentSchemaIds, ajv).reduce(
    getSchemaReducer<StoryblokElement>({
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
      schemaPost
    }),
    []
  );
}

const mapping: ITypeMapping = {
  [TypeName.String]: 'text',
  [TypeName.Integer]: 'number',
  [TypeName.Boolean]: 'boolean',
  [TypeName.Array]: 'array',
  [TypeName.Object]: 'bloks',
  [TypeName.Null]: 'text',
  [TypeName.Number]: 'number'
};

function basicMapping(property: JSONSchema.Interface): GenericType {
  if (property.type === 'string' && property.enum && property.enum.length) {
    return 'option';
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

function processObject({
  name,
  description,
  subSchema,
  rootSchema,
  fields
}: IProcessInterface<StoryblokElement>): StoryblokElement {
  if (rootSchema.$id === subSchema.$id) {
    if (!fields) throw new Error('Missing fields on object to process');

    const field: StoryblokElement = {
      name: name,
      display_name: toPascalCase(name),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      id: 0,
      schema: (fields as IStoryblokSchemaElement[]).reduce((schema, field) => {
        schema[field.key] = field;
        return schema;
      }, {} as Record<string, IStoryblokSchemaElement>),
      is_nestable: false,
      real_name: toPascalCase(name)
    };

    return field;
  } else {
    const field: StoryblokElement = {
      display_name: toPascalCase(name),
      key: name,
      type: basicMapping(subSchema)
      // fields: fields
    };

    // TODO this is suspect, should expect an object here when in processObject
    if (subSchema.default) field.default_value = subSchema.default as string;

    if (description) field.description = description;

    field.required = subSchema.required?.includes(name) || false;

    return field;
  }
}

function processRefArray({
  name,
  description,
  rootSchema
}: // fields
IProcessInterface<StoryblokElement>): StoryblokElement {
  const field: StoryblokElement = {
    display_name: toPascalCase(name),
    key: name,
    type: 'bloks'
    // types: fields
  };

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return field;
}

function processObjectArray({
  name,
  description,
  subSchema,
  rootSchema
}: // fields
IProcessInterface<StoryblokElement>): StoryblokElement {
  const field: StoryblokElement = {
    display_name: toPascalCase(name),
    key: name,
    type: 'bloks'
    // types: fields
  };

  // TODO this is suspect, should expect an object here when in processObject
  if (rootSchema.default) field.default_value = subSchema.default as string;

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return field;
}

function processArray({
  name,
  description,
  subSchema,
  rootSchema
}: // arrayField
IProcessInterface<StoryblokElement>): StoryblokElement {
  const field: StoryblokElement = {
    display_name: toPascalCase(name),
    key: name,
    type: 'bloks'
  };

  // TODO this is suspect, should expect an object here when in processObject
  if (rootSchema.default) field.default_value = subSchema.default as string;

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  // if (arrayField && arrayField.fields) field.fields = arrayField.fields;

  return field;
}

function processEnum({
  name,
  description,
  subSchema,
  options
}: IProcessInterface<StoryblokElement>): StoryblokElement {
  const field: StoryblokElement = {
    display_name: toPascalCase(name),
    key: name,
    type: 'option'
  };

  if (subSchema.default) field.default_value = safeEnumKey(subSchema.default as string);

  if (description) field.description = description;

  if (options) {
    field.options = options.map((option) => {
      return { name: option.label, value: option.value };
    });
  }

  field.required = subSchema.required?.includes(name) || false;

  return field;
}

function processConst({ subSchema }: IProcessInterface<StoryblokElement>): StoryblokElement {
  return getInternalTypeDefinition(subSchema.const as string);
}

function processBasic({
  name,
  description,
  subSchema,
  rootSchema
}: IProcessInterface<StoryblokElement>): StoryblokElement {
  const type = basicMapping(subSchema);

  const field: StoryblokElement = {
    display_name: toPascalCase(name),
    key: name,
    type
  };

  // if (type === 'number') field.valueType = 'int';

  if (subSchema.default) field.default_value = subSchema.default as string;

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return field;
}

function getInternalTypeDefinition(type: string): StoryblokElement {
  return {
    display_name: toPascalCase(typeResolutionField),
    key: typeResolutionField,
    type: 'text',
    description: 'Internal type for interface resolution',
    default_value: type
  };
}

function buildDescription(d: JSONSchema.Interface): string {
  return d.description || d.title || '';
}
