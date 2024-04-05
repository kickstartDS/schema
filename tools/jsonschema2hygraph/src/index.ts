import {
  BatchMigrationCreateComponentFieldInput,
  BatchMigrationCreateEnumerableFieldInput,
  BatchMigrationCreateEnumerationInput,
  BatchMigrationCreateSimpleFieldInput,
  SimpleFieldType,
  VisibilityTypes
} from '@hygraph/management-sdk';
import {
  getSchemaName,
  getSchemasForIds,
  toPascalCase,
  getSchemaReducer,
  IProcessInterface,
  IReducerResult,
  IProcessFnResult,
  IConvertParams,
  capitalize
} from '@kickstartds/jsonschema-utils';
import { type JSONSchema } from 'json-schema-typed/draft-07';
import pluralize from 'pluralize';

// eslint-disable-next-line import/no-named-as-default-member
const { singular } = pluralize;

import { ComponentType, FieldType } from './@types/index.js';

export * from './@types/index.js';

const typeResolutionField: string = 'type';

export function configuration(
  converted: IReducerResult<ComponentType> = {
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

// TODO correct parameter documentation
/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export const convert = ({
  schemaIds,
  ajv,
  schemaPost,
  schemaClassifier
}: IConvertParams): IReducerResult<ComponentType> => {
  const reduced = getSchemasForIds(schemaIds, ajv).reduce(
    getSchemaReducer<FieldType, ComponentType>({
      ajv,
      typeResolutionField,
      buildDescription,
      safeEnumKey: (key) => key,
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

  return reduced;
};

function basicTypeMapping(property: JSONSchema.Interface): string {
  if (property.type === 'string' && property.enum && property.enum.length) {
    return 'string';
  }

  if (property.type === 'string' && property.format && property.format === 'markdown') {
    return 'rich-text';
  }

  if (property.type === 'string' && property.format && property.format === 'image') {
    return 'image';
  }

  if (property.type === 'string' && property.format && property.format === 'date') {
    return 'string';
  }

  if (property.type === 'string' && property.format && property.format === 'id') {
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

  return '';
}

function componentsEqual(componentOne: ComponentType, componentTwo: ComponentType): boolean {
  return componentOne.apiId === componentTwo.apiId;
}

function processObject({
  name,
  fields,
  classification,
  parentSchema,
  subSchema,
  description
}: IProcessInterface<FieldType>): IProcessFnResult<FieldType, ComponentType> {
  if (!fields) throw new Error('Missing fields on object to process');
  if (parentSchema && parentSchema.type === 'array') {
    const componentName =
      classification && ['component', 'template', 'global'].includes(classification) && subSchema.$id
        ? getSchemaName(subSchema.$id)
        : name;

    if (getApiId(componentName) === pluralize(getApiId(componentName))) {
      console.log(componentName);
    }

    const component: ComponentType = {
      apiId: singular(getApiId(componentName)),
      apiIdPlural: pluralize(getApiId(componentName)),
      displayName: toPascalCase(componentName),
      description,
      fields: fields.map((field) => {
        field.parentApiId = singular(getApiId(componentName));
        return field;
      })
    };

    const field: BatchMigrationCreateComponentFieldInput = {
      apiId: name.replace('-', '_'),
      displayName: toPascalCase(name),
      visibility: VisibilityTypes.ReadWrite,
      parentApiId: 'REPLACED LATER',
      isList: true,
      componentApiId: singular(getApiId(componentName))
    };

    return { field, components: [component] };
  }

  if (getApiId(name) === pluralize(getApiId(name))) {
    console.log(name);
  }

  const component: ComponentType = {
    apiId: singular(getApiId(name)),
    apiIdPlural: pluralize(getApiId(name)),
    displayName: toPascalCase(name),
    description,
    fields: fields.map((field) => {
      field.parentApiId = singular(getApiId(name));
      return field;
    })
  };

  const field: BatchMigrationCreateComponentFieldInput = {
    apiId: name.replace('-', '_'),
    displayName: toPascalCase(name),
    visibility: VisibilityTypes.ReadWrite,
    parentApiId: 'REPLACED LATER',
    isList: false,
    componentApiId: singular(getApiId(name))
  };

  if (classification) {
    if (classification === 'component') {
      return { field, components: [component] };
    }
    if (classification === 'template') {
      return { field, templates: [component] };
    }
    if (classification === 'global') {
      return { field, globals: [component] };
    }
  }

  return { field: field, components: [component] };
}

function processRef({
  name,
  fields,
  description
}: IProcessInterface<FieldType>): IProcessFnResult<FieldType, ComponentType> {
  if (!fields) throw new Error('Missing fields on object to process');

  if (getApiId(name) === pluralize(getApiId(name))) {
    console.log(name);
  }

  const component: ComponentType = {
    apiId: singular(getApiId(name)),
    apiIdPlural: pluralize(getApiId(name)),
    displayName: toPascalCase(name),
    description,
    fields: fields.map((field) => {
      field.parentApiId = singular(getApiId(name));
      return field;
    })
  };

  const field: BatchMigrationCreateComponentFieldInput = {
    apiId: name.replace('-', '_'),
    displayName: toPascalCase(name),
    visibility: VisibilityTypes.ReadWrite,
    parentApiId: 'REPLACED LATER',
    isList: false,
    componentApiId: singular(getApiId(name))
  };

  return { field, components: [component] };
}

function processRefArray({
  name,
  description,
  fields
}: IProcessInterface<FieldType>): IProcessFnResult<FieldType, ComponentType> {
  if (!fields) throw new Error('Missing fields on array to process');

  if (getApiId(name) === pluralize(getApiId(name))) {
    console.log(name);
  }

  const component: ComponentType = {
    apiId: singular(getApiId(name)),
    apiIdPlural: pluralize(getApiId(name)),
    displayName: toPascalCase(name),
    description,
    fields: fields.map((field) => {
      field.parentApiId = singular(getApiId(name));
      return field;
    })
  };

  const field: BatchMigrationCreateComponentFieldInput = {
    apiId: name.replace('-', '_'),
    displayName: toPascalCase(name),
    visibility: VisibilityTypes.ReadWrite,
    parentApiId: 'REPLACED LATER',
    isList: true,
    componentApiId: singular(getApiId(name))
  };

  return { field, components: [component] };
}

function processObjectArray({
  name
}: IProcessInterface<FieldType>): IProcessFnResult<FieldType, ComponentType> {
  const field: BatchMigrationCreateSimpleFieldInput = {
    apiId: name.replace('-', '_'),
    displayName: toPascalCase(name),
    visibility: VisibilityTypes.ReadWrite,
    parentApiId: 'REPLACED LATER',
    isList: true,
    type: SimpleFieldType.String
  };

  return { field };
}

function processArray({
  subSchema,
  arrayField
}: IProcessInterface<FieldType>): IProcessFnResult<FieldType, ComponentType> {
  if (!arrayField) throw new Error('Missing array field on process array');

  if (typeof subSchema.items !== 'object')
    throw new Error("Can't process array without single object definition");

  if (Array.isArray(subSchema.items)) throw new Error("Can't process array with multiple items");

  const field: FieldType = {
    ...arrayField,
    isList: true
  };

  return { field };
}

function processEnum({
  name,
  description,
  options
}: IProcessInterface<FieldType>): IProcessFnResult<FieldType, ComponentType> {
  const enumeration: BatchMigrationCreateEnumerationInput = {
    apiId: getApiId(name),
    description,
    displayName: toPascalCase(name),
    values:
      options?.map((option) => {
        return {
          apiId: option.value.replace('-', '_'),
          displayName: toPascalCase(option.label)
        };
      }) || []
  };

  const field: BatchMigrationCreateEnumerableFieldInput = {
    apiId: name.replace('-', '_'),
    displayName: toPascalCase(name),
    visibility: VisibilityTypes.ReadWrite,
    parentApiId: 'REPLACED LATER',
    isList: false,
    enumerationApiId: getApiId(name)
  };

  return { field, components: [enumeration] };
}

function processConst(props: IProcessInterface<FieldType>): IProcessFnResult<FieldType, ComponentType> {
  return { field: processBasic(props).field };
}

function processBasic({
  name,
  subSchema,
  parentSchema
}: IProcessInterface<FieldType>): IProcessFnResult<FieldType, ComponentType> {
  if (!parentSchema) throw new Error('Missing parent schema in basic processing');
  return {
    field: scalarMapping(subSchema, name).field
  };
}

function scalarMapping(
  property: JSONSchema.Interface,
  propertyName: string
): IProcessFnResult<FieldType, ComponentType> {
  const baseProps: Pick<FieldType, 'apiId' | 'displayName' | 'parentApiId'> = {
    apiId: propertyName.replace('-', '_'),
    displayName: toPascalCase(property.title || propertyName),
    parentApiId: 'REPLACED LATER'
  };

  if (property.type === 'string') {
    return {
      field: {
        ...baseProps,
        type: SimpleFieldType.String
      }
    };
  }

  if (property.type === 'integer' || property.type === 'number') {
    return {
      field: {
        ...baseProps,
        type: SimpleFieldType.Int
      }
    };
  }

  if (property.type === 'boolean') {
    return {
      field: {
        ...baseProps,
        type: SimpleFieldType.Boolean
      }
    };
  }

  // If no matches, fall back to text input
  console.log('unsupported property in scalarMapping, falling back to string input', property);
  return {
    field: {
      ...baseProps,
      type: SimpleFieldType.String
    }
  };
}

function buildDescription(d: JSONSchema.Interface): string {
  return d.description || d.title || '';
}

function getApiId(name: string): string {
  return capitalize(name).replace('-', '_');
}
