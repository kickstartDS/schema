/* eslint-disable @typescript-eslint/naming-convention */
import {
  getSchemasForIds,
  toPascalCase,
  getSchemaReducer,
  IProcessInterface,
  safeEnumKey,
  IReducerResult,
  IProcessFnResult,
  IProcessFnMultipleResult,
  IConvertParams
} from '@kickstartds/jsonschema-utils';
import { type JSONSchema, TypeName } from 'json-schema-typed/draft-07';
import { v4 as uuidv4 } from 'uuid';

import { GenericType, ITypeMapping, IStoryblokSchemaElement, IStoryblokBlock } from './@types/index.js';
export * from './@types/index.js';

const typeResolutionField: string = 'type';

const icons: Record<string, string> = {
  button: 'rectangle-horizontal',
  section: 'gallery-vertical',
  'tag-label': 'tag',
  contact: 'contact',
  'collapsible-box': 'unfold-vertical',
  'content-box': 'gantt-chart-square',
  headline: 'heading-1',
  'text-media': 'block-text-img-l',
  'teaser-box': 'kanban-square',
  'teaser-row': 'rows',
  'count-up': 'arrow-up-1-0',
  'logo-tiles': 'layout-grid',
  quote: 'quote',
  'quotes-slider': 'quote',
  related: 'milestone',
  storytelling: 'clapperboard',
  'visual-slider': 'image',
  visual: 'image',
  image: 'file-image',
  'media-video': 'file-video',
  'media-image': 'file-image',
  'media-lazyimage': 'image-plus',
  icon: 'chevron-right-circle',
  lightboxImage: 'bring-to-front'
};

const colors: Record<string, string> = {
  content: '#05566a',
  media: '#FBCE41'
};

/**
 *  # TODO
 *
 *  - [ ] add `pos` handling to get sensible order of fields
 *  - [ ] check descriptions, defaults, examples and required status for all fields
 *  - [ ] fix wrong `id`s, currently all set to `0`
 *  - [ ] check required status `pos`, `max_length`, `required`, `default_value`, `description` in types
 *  - [ ] block type for components seems to be unset after import (should be set to `Nestable block` for all components except for templates, which should be set to `Content type block`)
 *  - [ ] add all root components to Components group used in Section
 */

/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export function convert({
  schemaIds,
  ajv,
  schemaPost,
  schemaClassifier
}: IConvertParams): IReducerResult<IStoryblokBlock> {
  const reduced = getSchemasForIds(schemaIds, ajv).reduce(
    getSchemaReducer<IStoryblokSchemaElement, IStoryblokBlock>({
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
    {
      components: [],
      templates: [],
      globals: []
    }
  );

  /*
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
  }*/

  return reduced;
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

function isComponent(object: IStoryblokSchemaElement | IStoryblokBlock): object is IStoryblokBlock {
  return (
    ((object as IStoryblokBlock).is_root === undefined || (object as IStoryblokBlock).is_root === false) &&
    (object as IStoryblokBlock).id !== undefined
  );
}

function basicTypeMapping(property: JSONSchema.Interface): GenericType {
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

const componentGroups: Record<string, string> = {};

function processComponent({
  name,
  fields,
  classification
}: IProcessInterface<IStoryblokSchemaElement>): IReducerResult<IStoryblokBlock> {
  if (!fields) throw new Error('Missing fields on component to process');

  if (classification && classification === 'template') {
    const bloks: IStoryblokBlock[] = [
      {
        name,
        display_name: toPascalCase(name),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_root: true,
        id: 0,
        schema: fields.reduce<Record<string, IStoryblokSchemaElement>>((schema, field) => {
          schema[field.key] = field;
          return schema;
        }, {}),
        is_nestable: false,
        real_name: toPascalCase(name)
      }
    ];

    return { components: [], templates: bloks, globals: [] };
  } else if (classification && classification === 'global') {
    const bloks: IStoryblokBlock[] = [
      {
        name,
        display_name: toPascalCase(name),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        id: 0,
        schema: fields.reduce<Record<string, IStoryblokSchemaElement>>((schema, field) => {
          schema[field.key] = field;
          return schema;
        }, {}),
        is_nestable: false,
        real_name: toPascalCase(name)
      }
    ];

    return { components: [], templates: [], globals: bloks };
  }

  const bloks: IStoryblokBlock[] = [
    {
      name,
      display_name: toPascalCase(name),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      id: 0,
      schema: fields.reduce<Record<string, IStoryblokSchemaElement>>((schema, field) => {
        schema[field.key] = field;
        return schema;
      }, {}),
      is_nestable: false,
      real_name: toPascalCase(name)
    }
  ];

  return { components: bloks, templates: [], globals: [] };
}

function processObject({
  name,
  description,
  parentSchema,
  subSchema,
  fields
}: IProcessInterface<IStoryblokSchemaElement>): IProcessFnMultipleResult<
  IStoryblokSchemaElement,
  IStoryblokBlock
> {
  if (parentSchema && parentSchema.type === 'array') {
    componentGroups[name] ||= uuidv4();

    const field: IStoryblokSchemaElement = {
      id: 0,
      pos: 0,
      display_name: toPascalCase(name),
      key: name,
      type: 'bloks',
      restrict_type: 'groups',
      restrict_components: true,
      component_group_whitelist: [componentGroups[name]]
    };

    if (!fields || (fields && !(fields.length > 0))) throw new Error("Can't process object without fields");

    const blok: IStoryblokBlock = {
      name,
      display_name: toPascalCase(name),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      id: 0,
      schema:
        fields.reduce<Record<string, IStoryblokSchemaElement>>((schema, field) => {
          schema[field.key] = field;
          return schema;
        }, {}) || [],
      is_nestable: false,
      real_name: toPascalCase(name),
      color: colors[name] || '#05566a',
      icon: icons[name] || 'block-wallet',
      component_group_uuid: componentGroups[name],
      component_group_name: toPascalCase(name)
    };

    if (description) field.description = description;

    return { field, components: [blok] };
  } else {
    const tabId = `tab-${uuidv4()}`;
    const tab: IStoryblokSchemaElement = {
      id: 0,
      pos: 0,
      display_name: toPascalCase(name),
      key: tabId,
      keys: [],
      type: 'tab'
    };

    fields?.forEach((field) => {
      field.key = `${name}_${field.key}`;
      tab.keys?.push(field.key);
    });

    // TODO this is suspect, should expect an object here when in processObject
    if (subSchema.default) tab.default_value = subSchema.default;

    if (description) tab.description = description;

    tab.required = subSchema.required?.includes(name) || false;

    return { field: tab, fields };
  }
}

function processRefArray({
  name,
  description,
  rootSchema,
  fields
}: IProcessInterface<IStoryblokSchemaElement>): IProcessFnResult<IStoryblokSchemaElement, IStoryblokBlock> {
  componentGroups[name] ||= uuidv4();

  const field: IStoryblokSchemaElement = {
    id: 0,
    pos: 0,
    display_name: toPascalCase(name),
    key: name,
    type: 'bloks',
    restrict_type: 'groups',
    restrict_components: true,
    component_group_whitelist: [componentGroups[name]]
  };

  const componentFields: IStoryblokBlock[] = [];
  fields?.forEach((field) => {
    if (isComponent(field)) componentFields.push(field);
  });

  const bloks = componentFields?.map((field) => {
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

  return { field, components: bloks };
}

function processObjectArray({
  name,
  description,
  subSchema,
  rootSchema
}: IProcessInterface<IStoryblokSchemaElement>): IProcessFnResult<IStoryblokSchemaElement, IStoryblokBlock> {
  const field: IStoryblokSchemaElement = {
    id: 0,
    pos: 0,
    display_name: toPascalCase(name),
    key: name,
    type: 'bloks'
  };

  // TODO need to add components, too

  // TODO this is suspect, should expect an object here when in processObject
  if (rootSchema.default) field.default_value = subSchema.default;

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return { field };
}

function processArray({
  arrayField
}: IProcessInterface<IStoryblokSchemaElement>): IProcessFnResult<IStoryblokSchemaElement, IStoryblokBlock> {
  if (!arrayField) throw new Error('Missing array fields in conversion');
  // TODO this probably generates empty arrays somewhere
  // Can include stuff like :
  //   `{ display_name: 'Tags', key: 'tags', type: 'text', required: false }`
  // for the array field, e.g. in:
  // http://schema.mydesignsystem.com/blog-head.schema.json
  if (arrayField?.type === 'text') {
    const stringArrayField: IStoryblokSchemaElement = {
      id: 0,
      pos: 0,
      display_name: arrayField.display_name,
      type: 'array',
      key: arrayField.key
    };
    return { field: stringArrayField };
  }

  return { field: arrayField };
}

function processEnum({
  name,
  description,
  subSchema,
  options
}: IProcessInterface<IStoryblokSchemaElement>): IProcessFnResult<IStoryblokSchemaElement, IStoryblokBlock> {
  const field: IStoryblokSchemaElement = {
    id: 0,
    pos: 0,
    display_name: toPascalCase(name),
    key: name,
    type: 'option'
  };

  if (subSchema.default) field.default_value = safeEnumKey(subSchema.default);

  if (description) field.description = description;

  if (options) {
    field.options = options.map((option) => {
      return { name: option.label, value: option.value, _uid: uuidv4() };
    });
  }

  field.required = subSchema.required?.includes(name) || false;

  return { field };
}

function processConst({
  subSchema
}: IProcessInterface<IStoryblokSchemaElement>): IProcessFnResult<IStoryblokSchemaElement, IStoryblokBlock> {
  return { field: getInternalTypeDefinition(subSchema.const) };
}

function processBasic({
  name,
  description,
  subSchema,
  rootSchema
}: IProcessInterface<IStoryblokSchemaElement>): IProcessFnResult<IStoryblokSchemaElement, IStoryblokBlock> {
  const type = basicTypeMapping(subSchema);

  const field: IStoryblokSchemaElement = {
    id: 0,
    pos: 0,
    display_name: toPascalCase(name),
    key: name,
    type
  };

  if (subSchema.default) field.default_value = subSchema.default;

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return { field };
}

function getInternalTypeDefinition(type: string): IStoryblokSchemaElement {
  return {
    id: 0,
    pos: 0,
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
