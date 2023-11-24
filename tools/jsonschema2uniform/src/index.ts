import {
  getSchemaName,
  getSchemasForIds,
  toPascalCase,
  getSchemaReducer,
  IProcessInterface,
  IReducerResult,
  IProcessFnMultipleResult,
  IProcessFnResult
} from '@kickstartds/jsonschema-utils';
import { capitalCase, sentenceCase } from 'change-case';
import { type JSONSchema } from 'json-schema-typed/draft-07';

import {
  IConvertParams,
  NumberParamConfig,
  SelectParamConfiguration,
  TextParamConfig,
  UniformComponent,
  UniformComponentParameter,
  UniformElement,
  UniformSlot
} from './@types/index.js';
import { nameToId } from './utils.js';
export * from './@types/index.js';

const typeResolutionField: string = 'type';

const fieldIsUniformComponent = (field: UniformElement): field is UniformComponent => {
  return field.hasOwnProperty('icon') && field.hasOwnProperty('parameters');
};

// Un-mark fields as required
const unrequireParameters = (component: UniformComponent): void => {
  component.parameters?.forEach((parameter) => {
    if (!parameter.typeConfig) {
      return;
    }

    // TODO this forced type could possibly be replaced by another union type for all
    // the current Param types (`TextParamConfig`, `SelectParamConfiguration`, etc)
    (parameter.typeConfig as { required: boolean }).required = false;
  });
};

// The way reducer works, it's possible for objects to be converted into
// component shape but they don't get hoisted to top level because they don't
// have an ID. Since Uniform doesn't yet support object options, our current
// approach is to flatten those
const flattenNestedComponentObjects = (components: UniformComponent[]): UniformComponent[] => {
  const flattenComponentParameters = (
    component: UniformComponent & {
      parameters?: (UniformComponent | UniformComponentParameter)[];
    },
    // For nested parameters
    prefix?: {
      id: string;
      name: string;
    }
  ): void => {
    component.parameters = component.parameters?.reduce((parameters, parameterOrComponent) => {
      if (!fieldIsUniformComponent(parameterOrComponent)) {
        if (prefix) {
          (parameterOrComponent as UniformComponentParameter).id = `${prefix.id}__${
            (parameterOrComponent as UniformComponentParameter).id
          }`;
          (parameterOrComponent as UniformComponentParameter).name = `${prefix.name}: ${
            (parameterOrComponent as UniformComponentParameter).name
          }`;
        }

        return [...parameters, parameterOrComponent];
      }

      const actuallyComponent = parameterOrComponent as UniformComponent;

      unrequireParameters(actuallyComponent);
      flattenComponentParameters(
        actuallyComponent,
        prefix
          ? {
              id: `${prefix.id}__${actuallyComponent.id}`,
              name: `${prefix.name}: ${actuallyComponent.name}`
            }
          : {
              id: actuallyComponent.id,
              name: actuallyComponent.name
            }
      );

      if (actuallyComponent.parameters) {
        return [...parameters, ...actuallyComponent.parameters];
      } else {
        return parameters;
      }
    }, [] as UniformComponentParameter[]);

    if (prefix) {
      component.id = `${prefix.id}__${component.id}`;
      component.name = `${prefix.name}: ${component.name}`;
    }
  };

  components.forEach((component) => {
    flattenComponentParameters(component);
  });

  return components;
};

let extraComponents: Map<string, UniformComponent> = new Map();

// TODO correct parameter documentation
/**
 * @param jsonSchemas - An individual schema or an array of schemas, provided
 * either as Javascript objects or as JSON text.
 */
export const convert = ({
  schemaIds,
  ajv,
  schemaPost
}: IConvertParams): IReducerResult<UniformComponent, UniformComponent> => {
  extraComponents = new Map();

  const reduced = getSchemasForIds(schemaIds, ajv).reduce(
    getSchemaReducer<UniformComponent, UniformComponent, UniformElement>({
      ajv,
      typeResolutionField,
      buildDescription,
      safeEnumKey: (key) => key,
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

  return {
    components: [
      ...flattenNestedComponentObjects(reduced.components),
      ...Array.from(extraComponents.values())
    ],
    templates: []
  };
};

// TODO this is incomplete
function isField(object: UniformComponent | UniformComponentParameter): object is UniformComponentParameter {
  return (object as UniformComponentParameter).type !== undefined;
}

function isComponent(object: UniformComponent | UniformComponentParameter): object is UniformComponent {
  return !(object as UniformComponent).canBeComposition || true;
}

function isTemplate(object: UniformComponent | UniformComponentParameter): object is UniformComponent {
  return (object as UniformComponent).canBeComposition || false;
}

function basicMapping(property: JSONSchema.Interface): string {
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

function processComponent({
  name,
  fields
}: IProcessInterface<UniformElement>): IReducerResult<UniformElement, UniformElement> {
  if (!fields) throw new Error('Missing fields on object to process');

  const objects: UniformComponent[] = [];
  objects.push({
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
  });

  return { components: objects, templates: [] };
}

function processObject({
  name,
  fields
}: IProcessInterface<UniformElement>): IProcessFnMultipleResult<
  UniformElement,
  UniformElement,
  UniformElement
> {
  if (!fields) throw new Error('Missing fields on object to process');

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

  return { field: component, components: [], templates: [] };
}

function processRefArray({
  name,
  fields
}: IProcessInterface<UniformElement>): IProcessFnResult<UniformElement, UniformElement, UniformElement> {
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

  return { field: slot, components: [], templates: [] };
}

function processObjectArray({
  name
}: // description,
// subSchema,
// rootSchema,
// fields
IProcessInterface<UniformElement>): IProcessFnResult<UniformElement, UniformElement, UniformElement> {
  // TODO should try to get by without that forced type
  // const field: ObjectType<false> = {
  //   name: name.replace(/-/g, '_'),
  //   list: true,
  //   type: 'object',
  //   label: subSchema.title || toPascalCase(cleanFieldName(name)),
  //   templates: (fields as {
  //     label: string;
  //     name: string;
  //     fields: UniformComponent[];
  //   }[]).map(({label, ...rest}) => {
  //     return {
  //       ...rest,
  //       label: toPascalCase(cleanFieldName(label)),
  //     }
  //   }),
  // };

  // if (description)
  //   field.description = description;

  return { field: { name } as UniformElement, components: [], templates: [] };
}

function processArray({
  name,
  subSchema,
  arrayField,
  rootSchema
}: IProcessInterface<UniformElement>): IProcessFnResult<UniformElement, UniformElement, UniformElement> {
  if (!arrayField) throw new Error('Missing array field on process array');
  // const field: ObjectType<false> = {
  //   name: name.replace(/-/g, '_'),
  //   list: true,
  //   type: 'object',
  //   label: subSchema.title || toPascalCase(cleanFieldName(name)),
  //   templates: []
  // };

  // // TODO should try to get by without that forced type
  // if (arrayField) {
  //   const { label, ...rest } = arrayField;

  //   field.templates.push({
  //     label: toPascalCase(cleanFieldName(label)),
  //     ...rest
  //   } as {
  //     label: string;
  //     name: string;
  //     fields: UniformComponent[];
  //   });
  // }

  // if (description)
  //   field.description = description;

  if (typeof subSchema.items !== 'object')
    throw new Error("Can't process array without single object definition");

  if (Array.isArray(subSchema.items)) throw new Error("Can't process array with multiple items");

  const test = subSchema.items as JSONSchema.Object;
  const isComponentWithId = Boolean(test.$ref);

  const id = isComponentWithId
    ? (arrayField as UniformComponent).id
    : `${nameToId(getSchemaName(rootSchema.$id))}${capitalCase(arrayField.id)}`;

  const slot: UniformSlot = {
    id: nameToId(name),
    name: sentenceCase(name),
    allowedComponents: [id],
    inheritAllowedComponents: false
  };

  if (!test.$ref && !extraComponents.has(id)) {
    // This array item doesn't have an ID, which means it won't get registered
    // as a component, we will have to to it manually in a hacky way
    extraComponents.set(id, {
      ...arrayField,
      id,
      name: `${capitalCase(getSchemaName(rootSchema.$id))}: ${arrayField.name}`
    } as UniformComponent);
  }

  return { field: slot, components: [], templates: [] };
}

function processEnum({
  name,
  description,
  subSchema,
  options,
  parentSchema
}: IProcessInterface<UniformElement>): IProcessFnResult<UniformElement, UniformElement, UniformElement> {
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
      } as SelectParamConfiguration
    },
    components: [],
    templates: []
  };
}

function processConst(
  props: IProcessInterface<UniformElement>
): IProcessFnResult<UniformElement, UniformElement, UniformElement> {
  return { field: processBasic(props).field, components: [], templates: [] };
}

function processBasic({
  name,
  description,
  subSchema,
  parentSchema
}: IProcessInterface<UniformElement>): IProcessFnResult<UniformElement, UniformElement, UniformElement> {
  if (!parentSchema) throw new Error('Missing parent schema in basic processing');
  return {
    field: scalarMapping(subSchema, name, description, parentSchema).field,
    components: [],
    templates: []
  };
}

function scalarMapping(
  property: JSONSchema.Interface,
  propertyName: string,
  description: string,
  parentSchema: JSONSchema.Interface
): IProcessFnResult<UniformElement, UniformElement, UniformElement> {
  const baseProps: Pick<UniformComponentParameter, 'id' | 'name' | 'helpText'> = {
    id: property.$id ?? propertyName,
    name: sentenceCase(property.title || toPascalCase(propertyName)),
    helpText: description
  };

  // if (
  //   property.type === 'string' &&
  //   property.format &&
  //   property.format === 'markdown'
  // ) {
  //   return {
  //     label: property.title || toPascalCase(cleanFieldName(propertyName)),
  //     description,
  //     name: propertyName.replace('-', '_'),
  //     type: 'rich-text',
  //     required: parentSchema.required?.includes(cleanFieldName(propertyName)),
  //     ui: {
  //     },
  //   }
  // }

  // if (
  //   property.type === 'string' &&
  //   property.format &&
  //   property.format === 'image'
  // ) {
  //   return {
  //     label: property.title || toPascalCase(cleanFieldName(propertyName)),
  //     description,
  //     name: propertyName.replace('-', '_'),
  //     type: 'image',
  //     required: parentSchema.required?.includes(cleanFieldName(propertyName)),
  //   };
  // }

  // if (
  //   property.type === 'string' &&
  //   property.format &&
  //   property.format === 'date'
  // ) {
  //   return {
  //     label: property.title || toPascalCase(cleanFieldName(propertyName)),
  //     description,
  //     name: propertyName.replace('-', '_'),
  //     type: 'string',
  //     required: parentSchema.required?.includes(cleanFieldName(propertyName)),
  //     ui: {
  //       dateFormat: 'YYYY MM DD',
  //       defaultValue: property.default as string,
  //     },
  //   };
  // }

  // if (
  //   property.type === 'string' &&
  //   property.format &&
  //   property.format === 'id'
  // ) {
  //   return {
  //     label: property.title || toPascalCase(cleanFieldName(propertyName)),
  //     description,
  //     name: propertyName.replace('-', '_'),
  //     type: 'string',
  //     list: false,
  //     required: parentSchema.required?.includes(cleanFieldName(propertyName)),
  //     ui: {
  //       defaultValue: property.default as string
  //     },
  //   };
  // }

  // if (
  //   property.type === 'string' &&
  //   property.format &&
  //   property.format === 'color'
  // ) {
  //   return {
  //     label: property.title || toPascalCase(cleanFieldName(propertyName)),
  //     description,
  //     name: propertyName.replace('-', '_'),
  //     type: 'string',
  //     list: false,
  //     ui: {
  //       component: 'color',
  //       defaultValue: property.default as string
  //     },
  //   };
  // }

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
        } as TextParamConfig
      },
      components: [],
      templates: []
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
        } as NumberParamConfig
      },
      components: [],
      templates: []
    };
  }

  if (property.type === 'boolean') {
    return {
      field: {
        ...baseProps,
        type: 'checkbox'
      },
      components: [],
      templates: []
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
      } as TextParamConfig
    },
    components: [],
    templates: []
  };
}

function buildDescription(d: JSONSchema.Interface): string {
  return d.description || d.title || '';
}
