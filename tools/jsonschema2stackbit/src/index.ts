/* eslint-disable @typescript-eslint/naming-convention */
import {
  getSchemasForIds,
  toPascalCase,
  getSchemaReducer,
  IProcessInterface,
  safeEnumKey,
  IReducerResult,
  IProcessFnResult,
  IConvertParams,
  getSchemaName
} from '@kickstartds/jsonschema-utils';
import {
  DataModel,
  Field,
  FieldBasicProps,
  FieldEnum,
  FieldGroupItem,
  FieldList,
  FieldModel,
  FieldObject,
  FieldText,
  ObjectModel,
  PageModel
} from '@stackbit/types';
import { type JSONSchema, TypeName } from 'json-schema-typed/draft-07';
import { traverse } from 'object-traversal';

import { GenericType, ITypeMapping } from './@types/index.js';
export * from './@types/index.js';

const typeResolutionField: string = 'type';

export function configuration(
  converted: IReducerResult<ObjectModel, PageModel, DataModel> = {
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

function isObjectModel(field: unknown): field is ObjectModel {
  return typeof field === 'object' && field !== null && 'type' in field && field.type === 'object';
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
}: IConvertParams): IReducerResult<ObjectModel, PageModel, DataModel> {
  const reduced = getSchemasForIds(schemaIds, ajv).reduce(
    getSchemaReducer<Field, ObjectModel, PageModel, DataModel>({
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
    ({ value, parent }) => {
      if (value && value.group && value.group === 'INLINE') {
        const schema = parent?.find((field: Field) => isObjectModel(field) && field.name === value.name);
        if (
          schema &&
          isObjectModel(schema) &&
          schema.fields &&
          schema.fields.length > 0 &&
          Array.isArray(parent)
        ) {
          for (const field of schema.fields) {
            parent.unshift({
              ...field,
              name: `${value.name}_${field.name}`,
              group: value.group
            });
          }
        }
      }
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

function componentsEqual(componentOne: ObjectModel, componentTwo: ObjectModel): boolean {
  return componentOne.name === componentTwo.name;
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

function reduceFields(fields: Field[], subSchema: JSONSchema.Interface): [Field[], FieldGroupItem[]] {
  const fieldGroups: Record<string, FieldGroupItem> = {};
  const reducedFields = fields.reduce<Field[]>((fields, field) => {
    if (field.group && subSchema.properties) {
      const schemaField = subSchema.properties[field.name];
      if (isCmsAnnotatedSchema(schemaField)) {
        fieldGroups[field.group] ||= {
          name: field.group,
          label: schemaField['x-cms-group-title'] || toPascalCase(field.group),
          icon: schemaField['x-cms-group-icon'] || 'circle-question'
        };
      }
    }
    fields.push(field);
    return fields;
  }, []);

  return [reducedFields, Object.values(fieldGroups)];
}

function processObject({
  name,
  title,
  description,
  fields,
  classification,
  parentSchema,
  subSchema
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel, DataModel> {
  if (!fields) throw new Error('Missing fields on object to process');

  if (parentSchema && parentSchema.type === 'array') {
    const modelName =
      classification && ['component', 'template', 'global'].includes(classification) && subSchema.$id
        ? getSchemaName(subSchema.$id).replace('-', '_')
        : name.replace('-', '_');
    const modelLabel =
      (classification && ['component', 'template', 'global'].includes(classification) && subSchema.title) ||
      toPascalCase(modelName);

    const model: FieldModel = {
      name: name.replace('-', '_'),
      label: title || toPascalCase(name),
      description,
      type: 'model',
      models: [modelName]
    };
    if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
      model.group = subSchema['x-cms-group-name'];

    const [reducedFields, fieldGroups] = reduceFields(fields, subSchema);
    const field: ObjectModel = {
      name: modelName,
      label: modelLabel,
      description,
      type: 'object',
      fields: reducedFields,
      fieldGroups
    };

    return { field: model, components: [field] };
  } else if ((parentSchema && parentSchema.type === 'object') || (parentSchema && parentSchema.$ref)) {
    if (classification && ['component', 'template', 'global'].includes(classification)) {
      // This case is currently not hit for the Stackbit converter, keep it if the need arises
    } else {
      // This case is currently not hit for the Stackbit converter, keep it if the need arises
    }
  }

  if (classification) {
    const field: FieldObject = {
      name: name.replace('-', '_'),
      label: title || toPascalCase(name),
      description,
      type: 'object',
      fields: []
    };

    if (classification === 'component') {
      const [reducedFields, fieldGroups] = reduceFields(fields, subSchema);
      const object: ObjectModel = {
        name: name.replace('-', '_'),
        label: title || toPascalCase(name),
        description,
        type: 'object',
        fields: reducedFields,
        fieldGroups
      };

      return { field, components: [object] };
    }
    if (classification === 'template') {
      const [reducedFields, fieldGroups] = reduceFields(fields, subSchema);
      const template: PageModel = {
        name: name.replace('-', '_'),
        label: title || toPascalCase(name),
        description,
        type: 'page',
        hideContent: true,
        fields: reducedFields,
        fieldGroups
      };

      return { field, templates: [template] };
    }
    if (classification === 'global') {
      const [reducedFields, fieldGroups] = reduceFields(fields, subSchema);
      const global: DataModel = {
        name: name.replace('-', '_'),
        label: title || toPascalCase(name),
        description,
        type: 'data',
        fields: reducedFields,
        fieldGroups
      };

      return { field, globals: [global] };
    }
  }

  const [reducedFields, fieldGroups] = reduceFields(fields, subSchema);
  const field: FieldObject = {
    name: name.replace('-', '_'),
    label: title || toPascalCase(name),
    description,
    type: 'object',
    fields: reducedFields,
    fieldGroups
  };
  if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
    field.group = subSchema['x-cms-group-name'];
  if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-inline']) field.group = 'INLINE';

  return { field };
}

function processRef({
  name,
  title,
  description,
  fields,
  subSchema
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel, DataModel> {
  if (!fields) throw new Error('Missing fields on object to process');
  const modelName = getSchemaName(subSchema.$id).replace('-', '_');
  const modelLabel = subSchema.title || toPascalCase(modelName);

  const model: FieldModel = {
    name: name.replace('-', '_'),
    label: title || toPascalCase(name),
    description,
    type: 'model',
    models: [modelName]
  };
  if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
    model.group = subSchema['x-cms-group-name'];

  const [reducedFields, fieldGroups] = reduceFields(fields, subSchema);
  const field: ObjectModel = {
    name: modelName,
    label: modelLabel,
    description,
    type: 'object',
    fields: reducedFields,
    fieldGroups
  };

  return { field: model, components: [field] };
}

function processRefArray({
  name,
  title,
  description,
  rootSchema,
  subSchema,
  fields
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel, DataModel> {
  if (!fields) throw new Error('Missing fields on ref array to process');

  const field: FieldList = {
    name: name.replace('-', '_'),
    label: title || toPascalCase(name),
    type: 'list',
    items: {
      type: 'model',
      models: fields?.reduce<string[]>((models, field) => {
        models.push(field.name.replace('-', '_'));
        return models;
      }, [])
    }
  };

  if (description) field.description = description;

  if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
    field.group = subSchema['x-cms-group-name'];

  field.required = rootSchema.required?.includes(name) || false;

  return { field };
}

function processObjectArray({
  name,
  title,
  description,
  subSchema,
  rootSchema,
  fields
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel, DataModel> {
  if (!fields) throw new Error('Missing fields on object array to process');

  const objects: ObjectModel[] = [];
  for (const field of fields) {
    if (field.type === 'object') {
      objects.push({
        name: field.name.replace('-', '_'),
        label: field.label || toPascalCase(field.name),
        description,
        type: 'object',
        fields: field.fields
      });
    }
  }

  const field: FieldList = {
    name: name.replace('-', '_'),
    label: title || toPascalCase(name),
    type: 'list',
    items: {
      type: 'model',
      models: fields?.reduce<string[]>((models, field) => {
        models.push(field.name.replace('-', '_'));
        return models;
      }, [])
    }
  };

  // TODO this is suspect, should expect an object here when in processObject
  if (rootSchema.default) field.default = (subSchema.default as string).replace('-', '_');

  if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
    field.group = subSchema['x-cms-group-name'];

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return { field, components: objects, templates: [] };
}

function processArray({
  name,
  title,
  subSchema,
  arrayField
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel, DataModel> {
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
    const { name, label, description, ...listField } = arrayField;
    const field: FieldList = {
      name: name.replace('-', '_'),
      label,
      description,
      type: 'list',
      items: listField
    };
    if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
      field.group = subSchema['x-cms-group-name'];

    return { field };
  }

  if (arrayField.type === 'object') {
    const { name, label, description, ...listField } = arrayField;
    const field: FieldList = {
      name: name.replace('-', '_'),
      label,
      description,
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
      name: name.replace('-', '_'),
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
  description,
  subSchema,
  options
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel, DataModel> {
  const field: FieldEnum = {
    name: name.replace('-', '_'),
    label: title || toPascalCase(name),
    type: 'enum',
    options: []
  };

  if (subSchema.default) field.default = safeEnumKey(subSchema.default as string);

  if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
    field.group = subSchema['x-cms-group-name'];

  if (description) field.description = description;

  if (options) {
    field.options = options;
  }

  field.required = subSchema.required?.includes(name) || false;

  return { field };
}

function processConst({
  subSchema
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel, DataModel> {
  return { field: getInternalTypeDefinition(subSchema.const as string) };
}

function processBasic({
  name,
  title,
  description,
  subSchema,
  rootSchema
}: IProcessInterface<Field>): IProcessFnResult<Field, ObjectModel, PageModel, DataModel> {
  const type = basicTypeMapping(subSchema);

  let field: Field = {
    name: name.replace('-', '_'),
    label: title || toPascalCase(name),
    type: 'string'
  };

  if (type === 'string' && subSchema.format && subSchema.format === 'icon') {
    field = {
      name: name.replace('-', '_'),
      label: title || toPascalCase(name),
      type: 'string',
      controlType: 'custom-modal-html',
      controlFilePath: '.stackbit/fields/icon/index.html'
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
      name: name.replace('-', '_'),
      label: title || toPascalCase(name),
      type
    };
  }

  if (subSchema.default !== null) field.default = subSchema.default as string;

  if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
    field.group = subSchema['x-cms-group-name'];

  if (description) field.description = description;

  field.required = rootSchema.required?.includes(name) || false;

  return { field };
}

function getInternalTypeDefinition(type: string): FieldText {
  return {
    name: typeResolutionField.replace('-', '_'),
    label: toPascalCase(typeResolutionField),
    type: 'text',
    description: 'Internal type for interface resolution',
    default: type.replace('-', '_'),
    hidden: true
  };
}

function buildDescription(d: JSONSchema.Interface): string {
  return d.description || d.title || '';
}
