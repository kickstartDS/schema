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
import { capitalCase, sentenceCase } from 'change-case';
import { type JSONSchema } from 'json-schema-typed/draft-07';

import {
  INumberParamConfig,
  ISelectParamConfiguration,
  ITextParamConfig,
  UniformComponent,
  UniformElement,
  UniformSlot,
  UniformField,
  UniformComponentParameter
} from './@types/index.js';
import { nameToId } from './utils.js';
export * from './@types/index.js';

const typeResolutionField: string = 'type';

export function configuration(
  converted: IReducerResult<UniformComponent> = {
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
}: IConvertParams): IReducerResult<UniformComponent> => {
  const reduced = getSchemasForIds(schemaIds, ajv).reduce(
    getSchemaReducer<UniformField, UniformComponent>({
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

function componentsEqual(componentOne: UniformElement, componentTwo: UniformElement): boolean {
  return componentOne.name === componentTwo.name;
}

function processObject({
  name,
  fields,
  classification,
  parentSchema,
  subSchema,
  rootSchema
}: IProcessInterface<UniformField>): IProcessFnResult<UniformField, UniformElement> {
  if (!fields) throw new Error('Missing fields on object to process');
  if (parentSchema && parentSchema.type === 'array') {
    const componentName =
      classification && ['component', 'template', 'global'].includes(classification) && subSchema.$id
        ? getSchemaName(subSchema.$id)
        : name;

    const field: UniformSlot = {
      id: nameToId(name),
      name: sentenceCase(name),
      allowedComponents: [componentName],
      inheritAllowedComponents: false
    };

    const component: UniformComponent = {
      id: componentName,
      name: capitalCase(componentName),
      icon: 'screen',
      parameters: fields.filter((field): field is UniformComponentParameter => {
        return !field.hasOwnProperty('allowedComponents');
      }),
      canBeComposition: false,
      slots: fields.filter((field): field is UniformSlot => {
        return field.hasOwnProperty('allowedComponents');
      })
    };

    return { field, components: [component] };
  }

  const component: UniformComponent = {
    id: nameToId(name),
    name: capitalCase(name),
    // TODO Look into how we want to set the icon, or just default to some more
    // sensible default?
    icon: 'screen',
    parameters: fields.filter((field): field is UniformComponentParameter => {
      return !field.hasOwnProperty('allowedComponents');
    }),
    canBeComposition: false,
    slots: fields.filter((field): field is UniformSlot => {
      return field.hasOwnProperty('allowedComponents');
    })
  };

  const slot: UniformSlot = {
    id: nameToId(name),
    name: sentenceCase(name),
    allowedComponents: [component.id],
    inheritAllowedComponents: false
  };

  if (classification) {
    if (classification === 'component') {
      return { field: slot, components: [component] };
    }
    if (classification === 'template') {
      return { field: slot, templates: [component] };
    }
    if (classification === 'global') {
      return { field: slot, globals: [component] };
    }
  }

  const prefixedName = `${getSchemaName(parentSchema?.$id || rootSchema.$id)}-${nameToId(name)}`;
  component.id = prefixedName;
  component.name = capitalCase(prefixedName);

  slot.allowedComponents = [component.id];

  return { field: slot, components: [component] };
}

function processRef({
  name,
  fields
}: IProcessInterface<UniformField>): IProcessFnResult<UniformField, UniformElement> {
  if (!fields) throw new Error('Missing fields on object to process');

  const slot: UniformSlot = {
    id: nameToId(name),
    name: sentenceCase(name),
    allowedComponents: [name],
    inheritAllowedComponents: false
  };

  const component: UniformComponent = {
    id: nameToId(name),
    name: capitalCase(name),
    // TODO Look into how we want to set the icon, or just default to some more
    // sensible default?
    icon: 'screen',
    parameters: fields.filter((field): field is UniformComponentParameter => {
      return !field.hasOwnProperty('allowedComponents');
    }),
    canBeComposition: false,
    slots: fields.filter((field): field is UniformSlot => {
      return field.hasOwnProperty('allowedComponents');
    })
  };

  return { field: slot, components: [component] };
}

function processRefArray({
  name,
  fields
}: IProcessInterface<UniformField>): IProcessFnResult<UniformField, UniformElement> {
  if (!fields) throw new Error('Missing fields on array to process');
  // This will return a slot instead of a component parameter. Later on in
  // processObject function we extract those slots from fields into actual slots
  // array
  const slot: UniformSlot = {
    id: nameToId(name),
    name: sentenceCase(name),
    allowedComponents: fields.map((field) => field.id),
    inheritAllowedComponents: false
  };

  return { field: slot, components: fields };
}

function processObjectArray({
  name
}: IProcessInterface<UniformField>): IProcessFnResult<UniformField, UniformElement> {
  const field: UniformComponentParameter = {
    id: nameToId(name),
    name: capitalCase(name),
    type: 'string'
  };

  return { field };
}

function processArray({
  name,
  subSchema,
  arrayField
}: IProcessInterface<UniformField>): IProcessFnResult<UniformField, UniformElement> {
  if (!arrayField) throw new Error('Missing array field on process array');

  if (typeof subSchema.items !== 'object')
    throw new Error("Can't process array without single object definition");

  if (Array.isArray(subSchema.items)) throw new Error("Can't process array with multiple items");

  const test = subSchema.items as JSONSchema.Object;
  const isComponentWithId = Boolean(test.$ref);

  // TODO this seems not done, possibly... re-check
  // console.log(isComponentWithId, test.$ref, arrayField.id);
  const id = isComponentWithId ? (arrayField as UniformComponent).id : `${arrayField.id}`;

  const slot: UniformSlot = {
    id: nameToId(name),
    name: sentenceCase(name),
    allowedComponents: [id],
    inheritAllowedComponents: false
  };

  return { field: slot, components: [arrayField] };
}

function processEnum({
  name,
  description,
  subSchema,
  options,
  parentSchema
}: IProcessInterface<UniformField>): IProcessFnResult<UniformField, UniformElement> {
  return {
    field: {
      id: subSchema.$id ?? name,
      name: sentenceCase(subSchema.title || toPascalCase(name)),
      helpText: description,
      type: 'select',
      typeConfig: {
        required: parentSchema?.required?.includes(name),
        options: options?.map((option) => {
          return {
            text: option.label,
            value: option.value
          };
        })
      } as ISelectParamConfiguration
    }
  };
}

function processConst(
  props: IProcessInterface<UniformField>
): IProcessFnResult<UniformField, UniformElement> {
  return { field: processBasic(props).field };
}

function processBasic({
  name,
  description,
  subSchema,
  parentSchema
}: IProcessInterface<UniformField>): IProcessFnResult<UniformField, UniformElement> {
  if (!parentSchema) throw new Error('Missing parent schema in basic processing');
  return {
    field: scalarMapping(subSchema, name, description, parentSchema).field
  };
}

function scalarMapping(
  property: JSONSchema.Interface,
  propertyName: string,
  description: string,
  parentSchema: JSONSchema.Interface
): IProcessFnResult<UniformField, UniformElement> {
  const baseProps: Pick<UniformComponentParameter, 'id' | 'name' | 'helpText'> = {
    id: property.$id ?? propertyName,
    name: sentenceCase(property.title || toPascalCase(propertyName)),
    helpText: description
  };

  if (property.type === 'string') {
    const isImage = property.format && property.format === 'image';

    return {
      field: {
        ...baseProps,
        type: 'text',
        typeConfig: {
          required: parentSchema.required?.includes(propertyName),
          // A very hacky way to detect whether it should be multiline or not :D
          multiline: !isImage && typeof property.default === 'string' && property.default.length > 30
        } as ITextParamConfig
      }
    };
  }

  if (property.type === 'integer' || property.type === 'number') {
    return {
      field: {
        ...baseProps,
        type: 'number',
        typeConfig: {
          required: parentSchema.required?.includes(propertyName),
          decimal: property.type === 'number'
        } as INumberParamConfig
      }
    };
  }

  if (property.type === 'boolean') {
    return {
      field: {
        ...baseProps,
        type: 'checkbox'
      }
    };
  }

  // If no matches, fall back to text input
  console.log('unsupported property in scalarMapping, falling back to string input', property);
  return {
    field: {
      ...baseProps,
      type: 'text',
      typeConfig: {
        required: parentSchema.required?.includes(propertyName),
        // A very hacky way to detect whether it should be multiline or not :D
        multiline: typeof property.default === 'string' && property.default.length > 30
      } as ITextParamConfig
    }
  };
}

function buildDescription(d: JSONSchema.Interface): string {
  return d.description || d.title || '';
}
