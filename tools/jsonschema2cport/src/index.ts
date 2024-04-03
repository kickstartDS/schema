import {
  getSchemaName,
  getSchemasForIds,
  toPascalCase,
  getSchemaReducer,
  IProcessInterface,
  IReducerResult,
  IProcessFnResult,
  IConvertParams
} from '@kickstartds/jsonschema-utils';
import { type JSONSchema } from 'json-schema-typed/draft-07';

import {
  ContentType,
  ContentTypeField,
  ContentTypeVariant,
  ContentTypeFieldConnectionVisualization,
  ContentFieldType
} from './index.js';

export * from './@types/index.js';

const typeResolutionField: string = 'type';

export function configuration(
  converted: IReducerResult<ContentType> = {
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
}: IConvertParams): IReducerResult<ContentType> => {
  const reduced = getSchemasForIds(schemaIds, ajv).reduce(
    getSchemaReducer<ContentTypeField, ContentType>({
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

function componentsEqual(componentOne: ContentType, componentTwo: ContentType): boolean {
  return componentOne.name === componentTwo.name;
}

function processObject({
  name,
  fields,
  classification,
  parentSchema,
  subSchema
}: IProcessInterface<ContentTypeField>): IProcessFnResult<ContentTypeField, ContentType> {
  if (!fields) throw new Error('Missing fields on object to process');
  if (parentSchema && parentSchema.type === 'array') {
    const componentName =
      classification && ['component', 'template', 'global'].includes(classification) && subSchema.$id
        ? getSchemaName(subSchema.$id)
        : name;

    const field: ContentTypeField = {
      id: name,
      name: toPascalCase(name),
      type: ContentFieldType.Connection,
      options: {
        connection: {
          connectedIds: [componentName],
          // max: 1,
          // min: 0,
          variant: ContentTypeVariant.Component,
          visualization: ContentTypeFieldConnectionVisualization.Deafult
        }
      }
    };

    const component: ContentType = {
      id: componentName,
      name: toPascalCase(componentName),
      groups: [
        {
          id: 'default',
          name: 'Default',
          contentTypeId: componentName,
          fields
          // position: 0
        }
      ]
    };

    return { field, components: [component] };
  }

  const component: ContentType = {
    id: name,
    name: toPascalCase(name),
    groups: [
      {
        id: 'default',
        name: 'Default',
        contentTypeId: name,
        fields
        // position: 0
      }
    ]
  };

  const field: ContentTypeField = {
    id: name,
    name: toPascalCase(name),
    type: ContentFieldType.Connection,
    options: {
      connection: {
        connectedIds: [name],
        // max: 1,
        // min: 0,
        variant: ContentTypeVariant.Component,
        visualization: ContentTypeFieldConnectionVisualization.Deafult
      }
    }
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
  fields
}: IProcessInterface<ContentTypeField>): IProcessFnResult<ContentTypeField, ContentType> {
  if (!fields) throw new Error('Missing fields on object to process');

  const field: ContentTypeField = {
    id: name,
    name: toPascalCase(name),
    type: ContentFieldType.Connection,
    options: {
      connection: {
        connectedIds: [name],
        // max: 1,
        // min: 0,
        variant: ContentTypeVariant.Component,
        visualization: ContentTypeFieldConnectionVisualization.Deafult
      }
    }
  };

  const component: ContentType = {
    id: name,
    name: toPascalCase(name),
    groups: [
      {
        id: 'default',
        name: 'Default',
        contentTypeId: name,
        fields
      }
    ]
  };

  return { field, components: [component] };
}

function processRefArray({
  name,
  fields
}: IProcessInterface<ContentTypeField>): IProcessFnResult<ContentTypeField, ContentType> {
  if (!fields) throw new Error('Missing fields on array to process');

  const field: ContentTypeField = {
    id: name,
    name: toPascalCase(name),
    type: ContentFieldType.Connection,
    options: {
      connection: {
        connectedIds: [name],
        // max: 1,
        // min: 0,
        variant: ContentTypeVariant.Component,
        visualization: ContentTypeFieldConnectionVisualization.Deafult
      }
    }
  };

  return { field, components: fields };
}

function processObjectArray({
  name
}: IProcessInterface<ContentTypeField>): IProcessFnResult<ContentTypeField, ContentType> {
  const field: ContentTypeField = {
    id: name,
    name: toPascalCase(name),
    type: ContentFieldType.String
  };

  return { field };
}

function processArray({
  name,
  subSchema,
  arrayField
}: IProcessInterface<ContentTypeField>): IProcessFnResult<ContentTypeField, ContentType> {
  if (!arrayField) throw new Error('Missing array field on process array');

  if (typeof subSchema.items !== 'object')
    throw new Error("Can't process array without single object definition");

  if (Array.isArray(subSchema.items)) throw new Error("Can't process array with multiple items");

  const field: ContentTypeField = {
    id: name,
    name: toPascalCase(name),
    type: ContentFieldType.Connection,
    options: {
      connection: {
        connectedIds: [name],
        // max: 1,
        // min: 0,
        variant: ContentTypeVariant.Component,
        visualization: ContentTypeFieldConnectionVisualization.Deafult
      }
    }
  };

  return { field, components: [arrayField] };
}

function processEnum({
  name,
  options
}: IProcessInterface<ContentTypeField>): IProcessFnResult<ContentTypeField, ContentType> {
  const field: ContentTypeField = {
    id: name,
    name: toPascalCase(name),
    type: ContentFieldType.Select,
    options: {
      select: {
        items: options?.map((option) => {
          return {
            key: option.label,
            value: option.value
          };
        })
      }
    }
  };

  return { field };
}

function processConst(
  props: IProcessInterface<ContentTypeField>
): IProcessFnResult<ContentTypeField, ContentType> {
  return { field: processBasic(props).field };
}

function processBasic({
  name,
  subSchema,
  parentSchema
}: IProcessInterface<ContentTypeField>): IProcessFnResult<ContentTypeField, ContentType> {
  if (!parentSchema) throw new Error('Missing parent schema in basic processing');
  return {
    field: scalarMapping(subSchema, name).field
  };
}

function scalarMapping(
  property: JSONSchema.Interface,
  propertyName: string
): IProcessFnResult<ContentTypeField, ContentType> {
  const baseProps: Pick<ContentTypeField, 'id' | 'name'> = {
    id: propertyName,
    name: toPascalCase(property.title || propertyName)
  };

  if (property.type === 'string') {
    return {
      field: {
        ...baseProps,
        type: ContentFieldType.String
      }
    };
  }

  if (property.type === 'integer' || property.type === 'number') {
    return {
      field: {
        ...baseProps,
        type: ContentFieldType.Int
      }
    };
  }

  if (property.type === 'boolean') {
    return {
      field: {
        ...baseProps,
        type: ContentFieldType.Boolean
      }
    };
  }

  // If no matches, fall back to text input
  console.log('unsupported property in scalarMapping, falling back to string input', property);
  return {
    field: {
      ...baseProps,
      type: ContentFieldType.String
    }
  };
}

function buildDescription(d: JSONSchema.Interface): string {
  return d.description || d.title || '';
}
