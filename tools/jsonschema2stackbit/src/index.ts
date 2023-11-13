/* eslint-disable @typescript-eslint/naming-convention */
import {
  getSchemasForIds,
  toPascalCase,
  getSchemaReducer,
  IProcessInterface,
  safeEnumKey
} from '@kickstartds/jsonschema-utils';
import { ObjectModel } from '@stackbit/types';
import { type JSONSchema, TypeName } from 'json-schema-typed/draft-07';
// import { traverse } from 'object-traversal';
import { v4 as uuidv4 } from 'uuid';

import { GenericType, IConvertParams, ITypeMapping } from './@types/index.js';
export * from './@types/index.js';

const typeResolutionField: string = 'type';

/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export function convert({ schemaIds, ajv, schemaPost }: IConvertParams): ObjectModel[] {
  const reduced = getSchemasForIds(schemaIds, ajv).reduce(
    getSchemaReducer<ObjectModel>({
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

  /*
  const nestedBloks: IStoryblokBlock[] = [];

  // Group first layer into tabs
  traverse(
    reduced,
    ({ key, value, parent }) => {
      if (parent && key && value.objectFields && value.objectFields.length > 0 && value.type === 'bloks') {
        const fields = (value.objectFields as IStoryblokSchemaElement[]).map((objectField) => {
          return {
            ...objectField,
            key: `${value.key}_${
              objectField.key || (objectField as StoryblokElement as IStoryblokBlock).name
            }`
          };
        });

        const tabId = `tab-${uuidv4()}`;
        parent[tabId] = {
          display_name: value.display_name,
          keys: fields.map((field) => field.key),
          type: 'tab'
        };
        fields.forEach((field) => (parent[field.key] = field));

        delete parent[key];
      }
    },
    {
      cycleHandling: false,
      traversalType: 'breadth-first'
    }
  );

  // Group second layer into sections
  traverse(
    reduced,
    ({ key, value, parent }) => {
      if (parent && key && value.objectFields && value.objectFields.length > 0 && value.type === 'bloks') {
        const fields = (value.objectFields as IStoryblokSchemaElement[]).map((objectField) => {
          return {
            ...objectField,
            key: `${value.key}_${objectField.key}`
          };
        });

        parent[key] = {
          keys: fields.map((field) => field.key),
          type: 'section'
        };
        fields.forEach((field) => (parent[field.key] = field));
      }
    },
    {
      cycleHandling: false,
      traversalType: 'breadth-first'
    }
  );

  // Split out component bloks
  traverse(
    reduced,
    ({ key, parent }) => {
      if (key === 'bloks') {
        nestedBloks.push(...parent?.bloks);
        delete parent?.bloks;
      }
    },
    {
      cycleHandling: false,
      traversalType: 'breadth-first'
    }
  );

  for (const nestedBlok of nestedBloks) {
    const blok = (reduced as IStoryblokBlock[]).find((b) => b.name === nestedBlok.name);
    if (blok) {
      blok.color = nestedBlok.color;
      blok.component_group_name = nestedBlok.component_group_name;
      blok.component_group_uuid = nestedBlok.component_group_uuid;
      blok.icon = nestedBlok.icon;
    } else {
      reduced.push(nestedBlok);
    }
  }
  */

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

const componentGroups: Record<string, string> = {};

function processObject({
  name,
  description,
  subSchema,
  rootSchema,
  fields
}: IProcessInterface<ObjectModel>): ObjectModel {
  if (rootSchema.$id === subSchema.$id) {
    if (!fields) throw new Error('Missing fields on object to process');

    const schemaElements: ObjectModel[] = [];

    fields.forEach((field) => {
      componentGroups[field.name] ||= uuidv4();

      if (field.name) {
        schemaElements.push({
          display_name: toPascalCase(field.name),
          key: field.name,
          type: 'bloks',
          restrict_type: 'groups',
          restrict_components: true,
          component_group_whitelist: [componentGroups[field.name]],
          bloks: [
            {
              ...field,
              color: colors[field.name] || '#05566a',
              icon: icons[field.name] || 'block-wallet',
              component_group_uuid: componentGroups[field.name],
              component_group_name: toPascalCase(field.name)
            }
          ]
        });
        return;
      } else {
        schemaElements.push(field);
        return;
      }
    });

    const field: ObjectModel = {
      name,
      display_name: toPascalCase(name),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      id: 0,
      schema: schemaElements.reduce((schema, field) => {
        schema[field.key] = field;
        return schema;
      }, {} as Record<string, ObjectModel>),
      is_nestable: false,
      real_name: toPascalCase(name)
    };

    return field;
  } else {
    const field: ObjectModel = {
      display_name: toPascalCase(name),
      key: name,
      type: basicMapping(subSchema)
    };

    if (fields) field.objectFields = fields;

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
  rootSchema,
  fields
}: IProcessInterface<ObjectModel>): ObjectModel {
  componentGroups[name] ||= uuidv4();

  const field: ObjectModel = {
    display_name: toPascalCase(name),
    key: name,
    type: 'bloks',
    restrict_type: 'groups',
    restrict_components: true,
    component_group_whitelist: [componentGroups[name]]
  };

  field.bloks = fields?.map((field) => {
    return {
      ...field,
      color: colors[name] || '#05566a',
      icon: icons[field.name] || 'block-wallet',
      component_group_uuid: componentGroups[name],
      component_group_name: toPascalCase(name)
    };
  });

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return field;
}

function processObjectArray({
  name,
  description,
  subSchema,
  rootSchema,
  fields
}: IProcessInterface<ObjectModel>): ObjectModel {
  const field: ObjectModel = {
    display_name: toPascalCase(name),
    key: name,
    type: 'bloks'
  };

  if (fields) field.objectArrayFields = fields;

  // TODO this is suspect, should expect an object here when in processObject
  if (rootSchema.default) field.default_value = subSchema.default as string;

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return field;
}

function processArray({
  name,
  // description,
  // subSchema,
  // rootSchema,
  arrayField
}: IProcessInterface<ObjectModel>): ObjectModel {
  const fields = arrayField?.objectFields;

  // TODO this probably generates empty arrays somewhere
  // Can include stuff like :
  //   `{ display_name: 'Tags', key: 'tags', type: 'text', required: false }`
  // for the array field, e.g. in:
  // http://schema.mydesignsystem.com/blog-head.schema.json
  if (arrayField?.type === 'text') {
    const stringArrayField: ObjectModel = {
      display_name: arrayField.display_name,
      type: 'array',
      key: arrayField.key
    };
    return stringArrayField;
  }

  if (arrayField.schema && Object.keys(arrayField.schema).length > 0) {
    return arrayField;
  }

  if (!fields) throw new Error('Missing fields in array');

  const schemaElements: ObjectModel[] = [];

  fields.forEach((field) => {
    componentGroups[field.name] ||= uuidv4();

    if (field.name) {
      schemaElements.push({
        display_name: toPascalCase(field.name),
        key: field.name,
        type: 'bloks',
        restrict_type: 'groups',
        restrict_components: true,
        component_group_whitelist: [componentGroups[field.name]],
        bloks: [
          {
            ...field,
            color: colors[field.name] || '#05566a',
            icon: icons[field.name] || 'block-wallet',
            component_group_uuid: componentGroups[field.name],
            component_group_name: toPascalCase(field.name)
          }
        ]
      });
      return;
    } else {
      schemaElements.push(field);
      return;
    }
  });

  const field: ObjectModel = {
    name,
    display_name: toPascalCase(name),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    id: 0,
    schema: schemaElements.reduce((schema, field) => {
      schema[field.key] = field;
      return schema;
    }, {} as Record<string, ObjectModel>),
    is_nestable: false,
    real_name: toPascalCase(name)
  };

  return field;

  // TODO this is suspect, should expect an object here when in processObject
  // if (rootSchema.default) field.default_value = subSchema.default as string;

  // if (description) field.description = description;

  // field.required = rootSchema.required?.includes(name) || false;

  // const fields: IStoryblokSchemaElement[] | undefined = (arrayField as IStoryblokSchemaElement).objectFields;

  // if (fields && fields.length > 0) field.arrayFields = fields;

  // return field;
}

function processEnum({ name, description, subSchema, options }: IProcessInterface<ObjectModel>): ObjectModel {
  const field: ObjectModel = {
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

function processConst({ subSchema }: IProcessInterface<ObjectModel>): ObjectModel {
  return getInternalTypeDefinition(subSchema.const as string);
}

function processBasic({
  name,
  description,
  subSchema,
  rootSchema
}: IProcessInterface<ObjectModel>): ObjectModel {
  const type = basicMapping(subSchema);

  const field: ObjectModel = {
    display_name: toPascalCase(name),
    key: name,
    type
  };

  if (subSchema.default) field.default_value = subSchema.default as string;

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return field;
}

function getInternalTypeDefinition(type: string): ObjectModel {
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
