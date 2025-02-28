/* eslint-disable @typescript-eslint/naming-convention */
import {
  getSchemasForIds,
  toPascalCase,
  getSchemaReducer,
  IProcessInterface,
  IReducerResult,
  IProcessFnResult,
  IConvertParams,
  getSchemaName
} from '@kickstartds/jsonschema-utils';
import { type JSONSchema, TypeName } from 'json-schema-typed/draft-07';
import { traverse } from 'object-traversal';
import { Block, CollectionConfig, Field, GlobalConfig } from 'payload';
import pluralize from 'pluralize-esm';

import { GenericType, ITypeMapping } from './@types/index.js';
export * from './@types/index.js';

const { singular } = pluralize;

const typeResolutionField: string = 'type';

export function configuration(
  converted: IReducerResult<Block, CollectionConfig, GlobalConfig> = {
    components: [],
    templates: [],
    globals: []
  }
): string {
  return JSON.stringify(
    { components: [...converted.components, ...converted.templates, ...converted.globals] },
    null,
    2
  );
}

// function isBlockModel(field: unknown): field is Block {
//   return (
//     typeof field === 'object' &&
//     field !== null &&
//     'fields' in field &&
//     'slug' in field &&
//     field.slug !== undefined
//   );
// }

function safeEnumKey(string: string): string {
  return string;
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
}: IConvertParams): IReducerResult<Block, CollectionConfig, GlobalConfig> {
  const reduced = getSchemasForIds(schemaIds, ajv).reduce(
    getSchemaReducer<Field, Block, CollectionConfig, GlobalConfig>({
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
    { components: [], templates: [], globals: [] }
  );

  traverse(
    reduced,
    ({ value: _value, parent: _parent }) => {
      // if (value && value.group && value.group.startsWith('INLINE__')) {
      //   const schema = parent?.find((field: Field) => isBlockModel(field) && field.name === value.name);
      //   if (
      //     schema &&
      //     isBlockModel(schema) &&
      //     schema.fields &&
      //     schema.fields.length > 0 &&
      //     Array.isArray(parent)
      //   ) {
      //     for (const field of schema.fields) {
      //       parent.splice(parent.indexOf(schema), 0, {
      //         ...field,
      //         name: `${value.name}__${field.name}`,
      //         group: field.group && field.group === 'content' ? undefined : field.group || value.name
      //       });
      //     }
      //     parent.splice(parent.indexOf(schema), 1);
      //   }
      // }
    },
    {
      cycleHandling: false,
      traversalType: 'breadth-first'
    }
  );

  return reduced;
}

const mapping: ITypeMapping = {
  [TypeName.String]: 'string',
  [TypeName.Integer]: 'number',
  [TypeName.Boolean]: 'boolean',
  [TypeName.Array]: 'list',
  [TypeName.Object]: 'object',
  [TypeName.Null]: 'text',
  [TypeName.Number]: 'number'
};

function basicTypeMapping(property: JSONSchema.Interface): GenericType {
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

function componentsEqual(componentOne: Block, componentTwo: Block): boolean {
  return componentOne.slug === componentTwo.slug;
}

function isCmsAnnotatedSchema(schema: unknown): schema is JSONSchema.Interface & {
  'x-cms-group-name': string;
  'x-cms-group-title'?: string;
  'x-cms-group-icon'?: string;
  'x-cms-group-inline'?: boolean;
} {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    (('x-cms-group-name' in schema && schema['x-cms-group-name'] !== undefined) ||
      ('x-cms-group-inline' in schema && schema['x-cms-group-inline'] === true))
  );
}

function processObject({
  name,
  title,
  fields,
  classification,
  parentSchema,
  subSchema
}: IProcessInterface<Field>): IProcessFnResult<Field, Block, CollectionConfig, GlobalConfig> {
  if (!fields) throw new Error('Missing fields on object to process');

  if (parentSchema && parentSchema.type === 'array') {
    const modelName =
      classification && ['component', 'template', 'global'].includes(classification) && subSchema.$id
        ? getSchemaName(subSchema.$id).replaceAll('-', '_')
        : singular(name.replaceAll('-', '_'));

    const field: Block = {
      slug: modelName,
      fields
    };

    const model: Field = {
      name: name.replaceAll('-', '_'),
      label: parentSchema.title || toPascalCase(name),
      type: 'blocks',
      blocks: [field]
    };

    // if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
    //   model.group = subSchema['x-cms-group-name'];

    return { field: model, components: [field] };
  } else if ((parentSchema && parentSchema.type === 'object') || (parentSchema && parentSchema.$ref)) {
    if (classification && ['component', 'template', 'global'].includes(classification)) {
      // This case is currently not hit for the Stackbit converter, keep it if the need arises
    } else {
      // This case is currently not hit for the Stackbit converter, keep it if the need arises
    }
  }

  if (classification) {
    const field: Field = {
      name: name.replaceAll('-', '_'),
      label: title || toPascalCase(name),
      type: 'blocks',
      blocks: []
    };

    if (classification === 'component') {
      const object: Block = {
        slug: name.replaceAll('-', '_'),
        labels: {
          singular: title || toPascalCase(name),
          plural: pluralize(title || toPascalCase(name))
        },
        fields
      };

      return { field, components: [object] };
    }
    if (classification === 'template') {
      const template: CollectionConfig = {
        slug: name.replaceAll('-', '_'),
        labels: {
          singular: title || toPascalCase(name),
          plural: pluralize(title || toPascalCase(name))
        },
        fields
      };

      return { field, templates: [template] };
    }
    if (classification === 'global') {
      const global: GlobalConfig = {
        slug: name.replaceAll('-', '_'),
        label: title || toPascalCase(name),
        fields
      };

      return { field, globals: [global] };
    }
  }

  const field: Field = {
    name: name.replaceAll('-', '_'),
    label: title || toPascalCase(name),
    type: 'blocks',
    blocks: []
  };
  // if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
  //   field.group = subSchema['x-cms-group-name'];
  // if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-inline'])
  //   field.group = `INLINE__${name.replaceAll('-', '_')}`;

  return { field };
}

function processRef({
  name,
  title,
  fields,
  subSchema
}: IProcessInterface<Field>): IProcessFnResult<Field, Block, CollectionConfig, GlobalConfig> {
  if (!fields) throw new Error('Missing fields on object to process');
  const modelName = getSchemaName(subSchema.$id).replaceAll('-', '_');
  const modelLabel = subSchema.title || toPascalCase(modelName);

  const field: Block = {
    slug: modelName,
    labels: {
      singular: modelLabel,
      plural: pluralize(modelLabel)
    },
    fields
  };

  const model: Field = {
    name: name.replaceAll('-', '_'),
    label: title || toPascalCase(name),
    type: 'blocks',
    blocks: [field]
  };
  // if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
  //   model.group = subSchema['x-cms-group-name'];

  return { field: model, components: [field] };
}

function processRefArray({
  name,
  title,
  rootSchema,
  // subSchema,
  fields
}: IProcessInterface<Field>): IProcessFnResult<Field, Block, CollectionConfig, GlobalConfig> {
  if (!fields) throw new Error('Missing fields on ref array to process');

  // const field: FieldList = {
  //   name: name.replaceAll('-', '_'),
  //   label: title || toPascalCase(name),
  //   type: 'list',
  //   items: {
  //     type: 'model',
  //     models: fields?.reduce<string[]>((models, field) => {
  //       models.push(field.name.replaceAll('-', '_'));
  //       return models;
  //     }, [])
  //   }
  // };

  const field: Field = {
    name: name.replaceAll('-', '_'),
    labels: {
      singular: title || toPascalCase(name),
      plural: pluralize(title || toPascalCase(name))
    },
    type: 'blocks',
    blocks: []
  };

  // if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
  //   field.group = subSchema['x-cms-group-name'];

  field.required = rootSchema.required?.includes(name) || false;

  return { field };
}

function processObjectArray({
  name,
  title,
  subSchema,
  rootSchema,
  fields
}: IProcessInterface<Field>): IProcessFnResult<Field, Block, CollectionConfig, GlobalConfig> {
  if (!fields) throw new Error('Missing fields on object array to process');

  const objects: Block[] = [];
  for (const field of fields) {
    if (field.type === 'object') {
      objects.push({
        name: field.name.replaceAll('-', '_'),
        label: field.label || toPascalCase(field.name),
        type: 'object',
        fields: field.fields
      });
    }
  }

  const field: FieldList = {
    name: name.replaceAll('-', '_'),
    label: title || toPascalCase(name),
    type: 'list',
    items: {
      type: 'model',
      models: fields?.reduce<string[]>((models, field) => {
        models.push(field.name.replaceAll('-', '_'));
        return models;
      }, [])
    }
  };

  // TODO this is suspect, should expect an object here when in processObject
  if (rootSchema.default) field.default = (subSchema.default as string).replaceAll('-', '_');

  if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
    field.group = subSchema['x-cms-group-name'];

  field.required = rootSchema.required?.includes(name) || false;

  return { field, components: objects, templates: [] };
}

function processArray({
  name,
  title,
  subSchema,
  arrayField
}: IProcessInterface<Field>): IProcessFnResult<Field, Block, CollectionConfig, GlobalConfig> {
  if (!arrayField || !arrayField.type) throw new Error('Missing type in array field');
  if (arrayField.type === 'list') throw new Error('Error type list encountered in processArray');
  if (arrayField.type === 'number') throw new Error('Error type number encountered in processArray');
  if (arrayField.type === 'enum') throw new Error('Error type enum encountered in processArray');
  if (arrayField.type === 'image') throw new Error('Error type image encountered in processArray');
  if (arrayField.type === 'style') throw new Error('Error type style encountered in processArray');
  if (arrayField.type === 'reference') throw new Error('Error type reference encountered in processArray');
  if (arrayField.type === 'cross-reference')
    throw new Error('Error type cross-reference encountered in processArray');

  if (arrayField.type === 'model') {
    const { name, label, ...listField } = arrayField;
    const field: FieldList = {
      name: name.replaceAll('-', '_'),
      label,
      type: 'list',
      items: listField
    };
    if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
      field.group = subSchema['x-cms-group-name'];

    return { field };
  }

  if (arrayField.type === 'object') {
    const { name, label, ...listField } = arrayField;
    const field: FieldList = {
      name: name.replaceAll('-', '_'),
      label,
      type: 'list',
      items: listField
    };
    if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
      field.group = subSchema['x-cms-group-name'];

    return { field };
  } else {
    const items: FieldBasicProps = {
      type: arrayField.type
    };
    const field: FieldList = {
      name: name.replaceAll('-', '_'),
      label: title || toPascalCase(name),
      type: 'list',
      items
    };
    if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
      field.group = subSchema['x-cms-group-name'];

    return { field };
  }
}

function processEnum({
  name,
  title,
  subSchema,
  parentSchema,
  options
}: IProcessInterface<Field>): IProcessFnResult<Field, Block, CollectionConfig, GlobalConfig> {
  const field: FieldEnum = {
    name: name.replaceAll('-', '_'),
    label: title || toPascalCase(name),
    type: 'enum',
    options: []
  };

  if (subSchema.default) field.default = safeEnumKey(subSchema.default as string);

  if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
    field.group = subSchema['x-cms-group-name'];

  if (options) {
    field.options = options;
  }

  field.required = parentSchema?.required?.includes(name) || false;

  return { field };
}

function processConst({
  subSchema
}: IProcessInterface<Field>): IProcessFnResult<Field, Block, CollectionConfig, GlobalConfig> {
  return { field: getInternalTypeDefinition(subSchema.const as string) };
}

function processBasic({
  name,
  title,
  subSchema,
  rootSchema
}: IProcessInterface<Field>): IProcessFnResult<Field, Block, CollectionConfig, GlobalConfig> {
  const type = basicTypeMapping(subSchema);

  let field: Field = {
    name: name.replaceAll('-', '_'),
    label: title || toPascalCase(name),
    type: 'string'
  };

  if (type === 'string' && subSchema.format && subSchema.format === 'icon') {
    field = {
      name: name.replaceAll('-', '_'),
      label: title || toPascalCase(name),
      type: 'string',
      controlType: 'custom-modal-html',
      controlFilePath: '.stackbit/fields/icon/index.html',
      controlOptions: [{ label: 'allowedIcons', value: JSON.stringify(subSchema.enum) }]
    };
  } else if (
    type === 'markdown' ||
    type === 'image' ||
    type === 'number' ||
    type === 'boolean' ||
    type === 'color' ||
    type === 'date' ||
    type === 'datetime' ||
    type === 'slug' ||
    type === 'text'
  ) {
    field = {
      name: name.replaceAll('-', '_'),
      label: title || toPascalCase(name),
      type
    };
  }

  if (subSchema.default !== null) field.default = subSchema.default as string;

  if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
    field.group = subSchema['x-cms-group-name'];

  field.required = rootSchema.required?.includes(name) || false;

  return { field };
}

function getInternalTypeDefinition(type: string): FieldText {
  return {
    name: typeResolutionField.replaceAll('-', '_'),
    label: toPascalCase(typeResolutionField),
    type: 'text',
    default: type.replaceAll('-', '_'),
    hidden: true
  };
}

function buildDescription(d: JSONSchema.Interface): string {
  return d.description || d.title || '';
}
