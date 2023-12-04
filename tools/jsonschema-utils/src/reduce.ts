import { type JSONSchema } from 'json-schema-typed/draft-07';

import { err, getSchemaName } from './helpers.js';

export type MyAjv = import('ajv').default;

export enum IClassifierResult {
  Component = 'component',
  Template = 'template',
  Global = 'global'
}
export interface IConvertParams {
  schemaIds: string[];
  ajv: MyAjv;
  schemaPost?: (schema: JSONSchema.Interface) => JSONSchema.Interface;
  schemaClassifier?: (schemaId: string) => IClassifierResult;
}

export interface IProcessInterface<Field> {
  name: string;
  description: string;
  subSchema: JSONSchema.Interface;
  rootSchema: JSONSchema.Interface;
  parentSchema?: JSONSchema.Interface;
  fields?: Field[];
  arrayField?: Field;
  options?: {
    label: string;
    value: string;
  }[];
  classification?: IClassifierResult;
}

export interface IReducerResult<Component, Template = Component, Global = Component> {
  components: Component[];
  templates: Template[];
  globals: Global[];
}

export interface IProcessFnResult<Field, Component = Field, Template = Component, Global = Component>
  extends Partial<IReducerResult<Component, Template, Global>> {
  field: Field;
}

export interface IProcessFnMultipleResult<Field, Component = Field, Template = Component, Global = Component>
  extends IProcessFnResult<Field, Component, Template, Global> {
  fields?: Field[];
}

export interface IProcessFn<Field, Component = Field, Template = Component, Global = Component> {
  (options: IProcessInterface<Field>): IProcessFnResult<Field, Component, Template, Global>;
}

export interface IProcessFnMultiple<Field, Component = Field, Template = Component, Global = Component> {
  (options: IProcessInterface<Field>): IProcessFnMultipleResult<Field, Component, Template, Global>;
}

export interface ISchemaReducerOptions<Field, Component = Field, Template = Component, Global = Component> {
  ajv: MyAjv;
  typeResolutionField: string;
  buildDescription: (d: JSONSchema.Interface) => string;
  safeEnumKey: (value: string) => string;
  basicTypeMapping: (property: JSONSchema.Interface) => string;
  processComponent: (object: IProcessInterface<Field>) => IReducerResult<Component, Template, Global>;
  processObject: IProcessFnMultiple<Field, Component, Template, Global>;
  processRefArray: IProcessFn<Field, Component, Template, Global>;
  processObjectArray: IProcessFn<Field, Component, Template, Global>;
  processArray: IProcessFn<Field, Component, Template, Global>;
  processEnum: IProcessFn<Field, Component, Template, Global>;
  processConst: IProcessFn<Field, Component, Template, Global>;
  processBasic: IProcessFn<Field, Component, Template, Global>;
  schemaPost?: (schema: JSONSchema.Interface) => JSONSchema.Interface;
  schemaClassifier?: (schemaId: string) => IClassifierResult;
  getSchemaFn?: (id: string) => JSONSchema.Interface;
}

export function getSchemaReducer<
  FieldType,
  ComponentType = FieldType,
  TemplateType = ComponentType,
  GlobalType = ComponentType
>({
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
  schemaClassifier,
  getSchemaFn
}: ISchemaReducerOptions<FieldType, ComponentType, TemplateType, GlobalType>): (
  knownObjects: IReducerResult<ComponentType, TemplateType, GlobalType>,
  schema: JSONSchema.Interface
) => IReducerResult<ComponentType, TemplateType, GlobalType> {
  function getSchema(id: string): JSONSchema.Interface {
    const validatorFunction = ajv.getSchema(id);

    if (!validatorFunction || !validatorFunction.schema)
      throw new Error(`Couldn't find schema for specified id string: ${id}`);

    return schemaPost
      ? schemaPost(validatorFunction.schema as JSONSchema.Interface)
      : (validatorFunction.schema as JSONSchema.Interface);
  }

  function schemaReducer(
    knownObjects: IReducerResult<ComponentType, TemplateType, GlobalType>,
    schema: JSONSchema.Interface
  ): IReducerResult<ComponentType, TemplateType, GlobalType> {
    if (schema.$id === undefined) throw err('Schema does not have an `$id` property.');

    const componentName = getSchemaName(schema.$id);
    const clonedSchema = schemaPost ? schemaPost(structuredClone(schema)) : structuredClone(schema);

    return buildComponent(componentName, clonedSchema, knownObjects);
  }

  function buildComponent(
    name: string,
    schema: JSONSchema.Interface,
    knownObjects: IReducerResult<ComponentType, TemplateType, GlobalType> = {
      components: [],
      templates: [],
      globals: []
    }
  ): IReducerResult<ComponentType, TemplateType, GlobalType> {
    if (!schema.properties) throw new Error("Can't process a component without properties.");

    const description = buildDescription(schema);

    const { components, templates, globals } = processComponent({
      name,
      description,
      subSchema: schema,
      rootSchema: schema,
      fields:
        Object.keys(schema.properties).length !== 0
          ? Object.keys(schema.properties).reduce<FieldType[]>((acc, propName) => {
              if (!schema.properties) throw new Error("Can't process a component without properties.");
              const objectSchema = structuredClone(schema.properties[propName] as JSONSchema.Interface);
              return acc.concat(buildType(propName, objectSchema, schema, knownObjects, schema));
            }, [])
          : [],
      classification:
        schemaClassifier && schema.$id ? schemaClassifier(schema.$id) : IClassifierResult.Component
    });

    knownObjects.components.push(...components);
    knownObjects.templates.push(...templates);
    knownObjects.globals.push(...globals);

    return knownObjects;
  }

  /**
   * Currently handles (but not necessarily supports) the following schema `type`s:
   * `array`, `boolean`, `integer`, `null`, `number`, `object` and `string`
   *
   * And the following JSON Schema keywords:
   * `oneOf`, `anyOf`, `allOf`, `not`, `$ref`, `enum`, `const`
   *
   * Unhandled `type`s and JSON Schema keywords (or combinations of those)
   * throw respectiv `Error()`s
   */
  function buildType(
    propName: string,
    schema: JSONSchema.Interface,
    outerSchema: JSONSchema.Interface,
    knownObjects: IReducerResult<ComponentType, TemplateType, GlobalType>,
    parentSchema?: JSONSchema.Interface
  ): FieldType | FieldType[] {
    const name = propName;

    // all of the following JSON Schema composition keywords (`oneOf`, `anyOf`, `allOf`, `not`)
    // need to be handled by the pre-processing, they'll throw if they get here

    // keyword oneOf?
    if (schema.oneOf !== undefined) {
      console.log('schema with oneOf', schema, outerSchema.$id);
      throw err(`The type oneOf on property ${name} is not supported.`);
    }

    // keyword anyOf?
    else if (schema.anyOf !== undefined) {
      console.log('schema with anyOf', schema, outerSchema.$id);
      throw err(`The type anyOf on property ${name} is not supported.`);
    }

    // keyword allOf?
    else if (schema.allOf !== undefined) {
      console.log('schema with allOf', propName, schema, parentSchema, outerSchema.$id);
      throw err(`The type allOf on property ${name} is not supported.`);
    }

    // keyword not?
    else if (schema.not !== undefined) {
      console.log('schema with not', schema, outerSchema.$id);
      throw err(`The type not on property ${name} is not supported.`);
    }

    // keyword ref?
    else if (schema.$ref !== undefined) {
      const reffedSchema = getSchemaFn ? getSchemaFn(schema.$ref) : getSchema(schema.$ref);
      return buildType(name, reffedSchema, reffedSchema, knownObjects, parentSchema);
    }

    // keyword enum?
    else if (schema.enum !== undefined) {
      if (schema.type !== 'string') throw err(`Only string enums are supported.`, name);
      const description = buildDescription(schema);
      const options: { label: string; value: string }[] = schema.enum.map((value) => {
        return {
          label: value as string,
          value: safeEnumKey(value as string)
        };
      });

      const { field, components, templates, globals } = processEnum({
        name,
        description,
        subSchema: schema,
        rootSchema: outerSchema,
        options,
        parentSchema
      });

      if (components && components.length) knownObjects.components.push(...components);
      if (templates && templates.length) knownObjects.templates.push(...templates);
      if (globals && globals.length) knownObjects.globals.push(...globals);

      return field;
    }

    // keyword const?
    else if (schema.const !== undefined) {
      const description = buildDescription(schema);

      if (name !== typeResolutionField) {
        console.log('schema.const that is not type', schema);
        throw err(`The const keyword, not on property ${typeResolutionField}, is not supported.`);
      }

      const { field, components, templates, globals } = processConst({
        name,
        description,
        subSchema: schema,
        rootSchema: outerSchema,
        parentSchema
      });

      if (components && components.length) knownObjects.components.push(...components);
      if (templates && templates.length) knownObjects.templates.push(...templates);
      if (globals && globals.length) knownObjects.globals.push(...globals);

      return field;
    }

    // type object?
    else if (schema.type === 'object') {
      if (!schema.properties) throw new Error("Can't process a component without properties.");

      const description = buildDescription(schema);

      const {
        field,
        fields = [],
        components,
        templates,
        globals
      } = processObject({
        name,
        description,
        subSchema: schema,
        rootSchema: outerSchema,
        parentSchema,
        fields:
          Object.keys(schema.properties).length !== 0
            ? Object.keys(schema.properties).reduce<FieldType[]>((acc, propName) => {
                if (!schema.properties) throw new Error("Can't process a component without properties.");
                const objectSchema = structuredClone(schema.properties[propName] as JSONSchema.Interface);
                return acc.concat(buildType(propName, objectSchema, outerSchema, knownObjects, schema));
              }, [])
            : []
      });

      if (components && components.length) knownObjects.components.push(...components);
      if (templates && templates.length) knownObjects.templates.push(...templates);
      if (globals && globals.length) knownObjects.globals.push(...globals);
      fields.push(field);

      return fields;
    }

    // type array?
    else if (schema.type === 'array') {
      if (schema.items && (schema.items as JSONSchema.Interface).anyOf) {
        const arraySchemas = (schema.items as JSONSchema.Interface).anyOf as JSONSchema.Interface[];
        const isRefArray = arraySchemas.length > 0 && arraySchemas.every((schema) => schema.$ref);
        const isObjectArray = arraySchemas.every((schema) => typeof schema === 'object');

        if (isRefArray) {
          const description = buildDescription(outerSchema);
          const fieldConfigs = arraySchemas.reduce<FieldType[]>((prev, arraySchema) => {
            if (!arraySchema.$ref) throw new Error('Found array entry without $ref in ref array');

            const resolvedSchema = getSchemaFn ? getSchemaFn(arraySchema.$ref) : getSchema(arraySchema.$ref);
            return prev.concat(
              buildType(
                getSchemaName(resolvedSchema.$id),
                resolvedSchema,
                resolvedSchema,
                knownObjects,
                parentSchema
              )
            );
          }, []);

          const { field, components, templates, globals } = processRefArray({
            name,
            description,
            subSchema: schema,
            rootSchema: outerSchema,
            fields: fieldConfigs
          });

          if (components && components.length) knownObjects.components.push(...components);
          if (templates && templates.length) knownObjects.templates.push(...templates);
          if (globals && globals.length) knownObjects.globals.push(...globals);

          return field;
        } else if (isObjectArray) {
          const description = buildDescription(outerSchema);
          const fieldConfigs = arraySchemas.reduce<FieldType[]>(
            (prev, arraySchema) =>
              prev.concat(
                buildType(
                  arraySchema.title?.toLowerCase() || '',
                  arraySchema,
                  outerSchema,
                  knownObjects,
                  parentSchema
                )
              ),
            []
          );

          const { field, components, templates, globals } = processObjectArray({
            name,
            description,
            subSchema: schema,
            rootSchema: outerSchema,
            fields: fieldConfigs
          });

          if (components && components.length) knownObjects.components.push(...components);
          if (templates && templates.length) knownObjects.templates.push(...templates);
          if (globals && globals.length) knownObjects.globals.push(...globals);

          return field;
        } else {
          throw err(`Incompatible anyOf declaration for array with type ${schema.type} on property ${name}.`);
        }
      } else if (schema.items && (schema.items as JSONSchema.Interface).oneOf) {
        throw err(`The type oneOf on array items of property ${name} is not supported.`);
      } else {
        const description = buildDescription(outerSchema);
        const arraySchema = schema.items as JSONSchema.Interface;

        let fieldConfig;
        if (arraySchema.$ref) {
          const resolvedSchema = getSchemaFn ? getSchemaFn(arraySchema.$ref) : getSchema(arraySchema.$ref);
          fieldConfig = buildType(
            getSchemaName(resolvedSchema.$id),
            resolvedSchema,
            resolvedSchema,
            knownObjects,
            schema
          );
        } else {
          fieldConfig = buildType(name, arraySchema, outerSchema, knownObjects, schema);
        }

        if (Array.isArray(fieldConfig) && fieldConfig.length !== 1) {
          throw new Error('Only single array items allowed currently');
        }

        const { field, components, templates, globals } = processArray({
          name,
          description,
          subSchema: schema,
          rootSchema: outerSchema,
          arrayField: Array.isArray(fieldConfig) ? fieldConfig[0] : fieldConfig
        });

        if (components && components.length) knownObjects.components.push(...components);
        if (templates && templates.length) knownObjects.templates.push(...templates);
        if (globals && globals.length) knownObjects.globals.push(...globals);

        return field;
      }
    }

    // basic type? (`boolean`, `integer`, `null`, `number`, `string`)
    else if (basicTypeMapping(schema)) {
      const description = buildDescription(schema);

      const { field, components, templates, globals } = processBasic({
        name,
        description,
        subSchema: schema,
        rootSchema: outerSchema,
        parentSchema
      });

      if (components && components.length) knownObjects.components.push(...components);
      if (templates && templates.length) knownObjects.templates.push(...templates);
      if (globals && globals.length) knownObjects.globals.push(...globals);

      return field;
    }

    // ¯\_(ツ)_/¯
    else throw err(`The type ${schema.type} on property ${name} is unknown.`);
  }

  return schemaReducer;
}
