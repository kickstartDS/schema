/* eslint-disable @typescript-eslint/naming-convention */
import {
  getSchemasForIds,
  toPascalCase,
  getSchemaReducer,
  IProcessInterface,
  safeEnumKey,
  IReducerResult,
  IProcessFnResult,
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
 *  - [ ] hide `type` fields in editor UI somehow, couldn't find a `hidden` attribute anywhere
 *  - [ ] add correct globals handling
 *  - [ ] handle `array` type cases
 *  - [ ] handle `href` / `link` type scenarios, should use Storyblok link UI control?
 *  - [ ] handle `image` scenarios better, some not translated to image controls
 *  - [ ] use more up-to-date mapping for image controls overall, probably `asset`?
 *  - [ ] more generic solution to encode icon assigment?
 *
 *  # DS Agency
 *
 *  - [ ] Add `Header` and `Footer` to `page.schema.json`
 *  - [ ] Extract SEO settings from `page.schema.json` to its own schema
 *
 *  # DS Agency Starter
 *
 *  - [ ] Add `Site Configuration` preview
 *  - [ ] Check all components / elements for functional completeness
 */

const componentGroups: Record<string, string> = {};

export function configuration(
  options: IReducerResult<IStoryblokBlock> = {
    components: [],
    templates: [],
    globals: []
  }
): string {
  return JSON.stringify(
    { components: [...options.components, ...options.templates, ...options.globals] },
    null,
    2
  );
}

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
    {
      components: [],
      templates: [],
      globals: []
    }
  );

  // TODO think about this again:
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

function componentsEqual(componentOne: IStoryblokBlock, componentTwo: IStoryblokBlock): boolean {
  return componentOne.name === componentTwo.name;
}

function processObject({
  name,
  description,
  parentSchema,
  subSchema,
  fields,
  classification,
  rootSchema
}: IProcessInterface<IStoryblokSchemaElement>): IProcessFnResult<IStoryblokSchemaElement, IStoryblokBlock> {
  if (!fields || (fields && !(fields.length > 0))) throw new Error("Can't process object without fields");
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

    const blok: IStoryblokBlock = {
      name,
      display_name: toPascalCase(name),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      id: 0,
      schema:
        fields.reduce<Record<string, IStoryblokSchemaElement>>((schema, field) => {
          schema[field.key] = field;
          if (field.objectFields) {
            for (const objectField of field.objectFields) {
              schema[objectField.key] = objectField;
            }
            delete field.objectFields;
          }
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
  } else if ((parentSchema && parentSchema.type === 'object') || (parentSchema && parentSchema.$ref)) {
    if (classification === 'component' || classification === 'template' || classification === 'global') {
      componentGroups[name] ||= uuidv4();

      const field: IStoryblokSchemaElement = {
        id: 0,
        pos: 0,
        key: name,
        type: 'bloks',
        display_name: toPascalCase(name),
        objectFields: fields
      };

      return { field };
    } else {
      const tabId = `tab-${uuidv4()}`;
      const tab: IStoryblokSchemaElement = {
        id: 0,
        pos: 0,
        display_name: toPascalCase(name),
        key: tabId,
        keys: [],
        type: 'tab',
        objectFields: fields
      };

      fields.forEach((field) => {
        field.key = `${name}_${field.key}`;
        tab.keys?.push(field.key);
      });

      // TODO this is suspect, should expect an object here when in processObject
      if (subSchema.default) tab.default_value = subSchema.default;

      if (description) tab.description = description;

      tab.required = subSchema.required?.includes(name) || false;

      return { field: tab };
    }
  }

  const bloks: IStoryblokBlock[] = [
    {
      name,
      display_name: toPascalCase(name),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_root: (classification && classification === 'template') || false,
      id: 0,
      schema: fields.reduce<Record<string, IStoryblokSchemaElement>>((schema, field) => {
        schema[field.key] = field;
        if (field.objectFields) {
          for (const objectField of field.objectFields) {
            schema[objectField.key] = objectField;
          }
          delete field.objectFields;
        }
        return schema;
      }, {}),
      is_nestable: false,
      real_name: toPascalCase(name)
    }
  ];

  const dummy: IStoryblokSchemaElement = {
    id: 0,
    pos: 0,
    display_name: 'Dummy',
    key: 'dummy',
    type: 'text',
    description: 'This is simply a Dummy field to satisfy the typings, it gets thrown out later'
  };
  if (classification && classification === 'template') {
    return { field: dummy, templates: bloks };
  } else if (classification && classification === 'global') {
    componentGroups.global ||= uuidv4();

    return {
      field: dummy,
      globals: bloks.map((blok) => {
        blok.component_group_name = 'Global';
        blok.component_group_uuid = componentGroups.global;
        return blok;
      })
    };
  } else if (classification && classification === 'component') {
    return { field: dummy, components: bloks };
  }
  throw new Error(
    `Can't process an object that's not either: the child of an array schema, child of an object schema, or component / template / global: ${rootSchema.$id}`
  );
}

function processRef({
  name,
  description,
  fields
}: IProcessInterface<IStoryblokSchemaElement>): IProcessFnResult<IStoryblokSchemaElement, IStoryblokBlock> {
  if (!fields || (fields && !(fields.length > 0))) throw new Error("Can't process object without fields");
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

  const blok: IStoryblokBlock = {
    name,
    display_name: toPascalCase(name),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    id: 0,
    schema:
      fields.reduce<Record<string, IStoryblokSchemaElement>>((schema, field) => {
        schema[field.key] = field;
        if (field.objectFields) {
          for (const objectField of field.objectFields) {
            schema[objectField.key] = objectField;
          }
          delete field.objectFields;
        }
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

  const bloks: IStoryblokBlock[] = [];
  if (fields) {
    bloks.push(
      ...fields.map((field) => {
        if (!field.objectFields || (field.objectFields && !(field.objectFields.length > 0)))
          throw new Error("Can't process object without fields");

        return {
          name: field.key,
          display_name: toPascalCase(field.key),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          id: 0,
          schema:
            field.objectFields.reduce<Record<string, IStoryblokSchemaElement>>((schema, field) => {
              schema[field.key] = field;
              if (field.objectFields) {
                for (const objectField of field.objectFields) {
                  schema[objectField.key] = objectField;
                }
                delete field.objectFields;
              }
              return schema;
            }, {}) || [],
          is_nestable: false,
          real_name: toPascalCase(name),
          color: colors[field.key] || '#05566a',
          icon: icons[field.key] || 'block-wallet',
          component_group_uuid: componentGroups[name],
          component_group_name: toPascalCase(name)
        };
      })
    );
  }

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return { field, components: bloks };
}

function processObjectArray(): IProcessFnResult<IStoryblokSchemaElement, IStoryblokBlock> {
  throw new Error(
    'Processing arrays of (structurally different) objects currently not supported by this Storyblok converter'
  );
}

function processArray({
  arrayField
}: IProcessInterface<IStoryblokSchemaElement>): IProcessFnResult<IStoryblokSchemaElement, IStoryblokBlock> {
  if (!arrayField) throw new Error('Missing array fields in conversion');
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
