import { type JSONSchema } from 'json-schema-typed/draft-07';
import _ from 'lodash';

import { err, getSchemaName } from './helpers.js';

declare type MyAjv = import('ajv').default;

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
}

export interface IReducerResult<Component, Template> {
  components: Component[];
  templates: Template[];
}

export interface IProcessFnResult<Field, Component, Template> extends IReducerResult<Component, Template> {
  field: Field;
}

export interface IProcessFnMultipleResult<Field, Component, Template>
  extends IProcessFnResult<Field, Component, Template> {
  fields?: Field[];
}

export interface IProcessFn<Field, Component, Template> {
  (options: IProcessInterface<Field>): IProcessFnResult<Field, Component, Template>;
}

export interface IProcessFnMultiple<Field, Component, Template> {
  (options: IProcessInterface<Field>): IProcessFnMultipleResult<Field, Component, Template>;
}

export interface ISchemaReducerOptions<Field, Component, Template> {
  ajv: MyAjv;
  typeResolutionField: string;
  buildDescription: (d: JSONSchema.Interface) => string;
  safeEnumKey: (value: string) => string;
  basicMapping: (property: JSONSchema.Interface) => string;
  processComponent: (object: IProcessInterface<Field>) => IReducerResult<Component, Template>;
  processObject: IProcessFnMultiple<Field, Component, Template>;
  processRefArray: IProcessFn<Field, Component, Template>;
  processObjectArray: IProcessFn<Field, Component, Template>;
  processArray: IProcessFn<Field, Component, Template>;
  processEnum: IProcessFn<Field, Component, Template>;
  processConst: IProcessFn<Field, Component, Template>;
  processBasic: IProcessFn<Field, Component, Template>;
  schemaPost?: (schema: JSONSchema.Interface) => JSONSchema.Interface;
  getSchemaFn?: (id: string) => JSONSchema.Interface;
  isField: (object: Field | Component | Template) => object is Field;
  isComponent: (object: Field | Component | Template) => object is Component;
  isTemplate: (object: Field | Component | Template) => object is Template;
}

// TODO layer those types, so it's possible to use `getSchemaReducer`
// with only 1 or 2 of those types, when they match (e.g. Netlify CMS)
export function getSchemaReducer<FieldType, ComponentType, TemplateType>({
  ajv,
  typeResolutionField,
  buildDescription,
  safeEnumKey,
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
  getSchemaFn
}: // isField,
// isComponent,
// isTemplate
ISchemaReducerOptions<FieldType, ComponentType, TemplateType>): (
  knownObjects: IReducerResult<ComponentType, TemplateType>,
  schema: JSONSchema.Interface
) => IReducerResult<ComponentType, TemplateType> {
  function getSchema(id: string): JSONSchema.Interface {
    const validatorFunction = ajv.getSchema(id);

    if (!validatorFunction || !validatorFunction.schema)
      throw new Error(`Couldn't find schema for specified id string: ${id}`);

    return schemaPost
      ? schemaPost(validatorFunction.schema as JSONSchema.Interface)
      : (validatorFunction.schema as JSONSchema.Interface);
  }

  function schemaReducer(
    knownObjects: IReducerResult<ComponentType, TemplateType>,
    schema: JSONSchema.Interface
  ): IReducerResult<ComponentType, TemplateType> {
    const $id = schema.$id;
    if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.');

    const typeName = getSchemaName($id);
    const clonedSchema = schemaPost ? schemaPost(_.cloneDeep(schema)) : _.cloneDeep(schema);

    buildComponent(typeName, clonedSchema, knownObjects);
    return knownObjects;
  }

  function buildComponent(
    name: string,
    schema: JSONSchema.Interface,
    knownObjects: IReducerResult<ComponentType, TemplateType> = { components: [], templates: [] }
  ): void {
    const description = buildDescription(schema);

    const { components, templates } = processComponent({
      name,
      description,
      subSchema: schema,
      rootSchema: schema,
      fields: !_.isEmpty(schema.properties)
        ? _.reduce<JSONSchema.Interface, FieldType[]>(
            schema.properties,
            (acc, prop: JSONSchema.Interface, fieldName) => {
              const objectSchema = _.cloneDeep(prop);
              return acc.concat(buildType(fieldName, objectSchema, schema, knownObjects, schema));
            },
            []
          )
        : []
    });

    knownObjects.components.push(...components);
    knownObjects.templates.push(...templates);
  }

  function buildType(
    propName: string,
    schema: JSONSchema.Interface,
    outerSchema: JSONSchema.Interface,
    knownObjects: IReducerResult<ComponentType, TemplateType> = { components: [], templates: [] },
    parentSchema?: JSONSchema.Interface
  ): FieldType | FieldType[] {
    const name = propName;

    // all of the following JSON Schema composition keywords need to
    // be handled by the pre-processing, they'll throw if they get here

    // oneOf?
    if (!_.isUndefined(schema.oneOf)) {
      console.log('schema with oneOf', schema, outerSchema.$id);
      throw err(`The type oneOf on property ${name} is not supported.`);
    }

    // anyOf?
    else if (!_.isUndefined(schema.anyOf)) {
      console.log('schema with anyOf', schema, outerSchema.$id);
      throw err(`The type anyOf on property ${name} is not supported.`);
    }

    // allOf?
    else if (!_.isUndefined(schema.allOf)) {
      console.log('schema with allOf', propName, schema, parentSchema, outerSchema.$id);
      throw err(`The type allOf on property ${name} is not supported.`);
    }

    // not?
    else if (!_.isUndefined(schema.not)) {
      console.log('schema with not', schema, outerSchema.$id);
      throw err(`The type not on property ${name} is not supported.`);
    }

    // object?
    else if (schema.type === 'object') {
      const description = buildDescription(schema);

      const {
        field,
        fields = [],
        components,
        templates
      } = processObject({
        name,
        description,
        subSchema: schema,
        rootSchema: outerSchema,
        parentSchema,
        fields: !_.isEmpty(schema.properties)
          ? _.reduce<JSONSchema.Interface, FieldType[]>(
              schema.properties,
              (acc, prop: JSONSchema.Interface, fieldName) => {
                const objectSchema = _.cloneDeep(prop);
                return acc.concat(buildType(fieldName, objectSchema, outerSchema, knownObjects, schema));
              },
              []
            )
          : []
      });

      knownObjects.components.push(...components);
      knownObjects.templates.push(...templates);
      fields.push(field);

      return fields;
    }

    // array?
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

          const { field, components, templates } = processRefArray({
            name,
            description,
            subSchema: schema,
            rootSchema: outerSchema,
            fields: fieldConfigs
          });

          knownObjects.components.push(...components);
          knownObjects.templates.push(...templates);

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

          const { field, components, templates } = processObjectArray({
            name,
            description,
            subSchema: schema,
            rootSchema: outerSchema,
            fields: fieldConfigs
          });

          knownObjects.components.push(...components);
          knownObjects.templates.push(...templates);

          return field;
        } else {
          throw err(`Incompatible anyOf declaration for array with type ${schema.type} on property ${name}.`);
        }
      } else if (schema.items && (schema.items as JSONSchema.Interface).oneOf) {
        console.log('schema with array items using oneOf', schema);
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

        const { field, components, templates } = processArray({
          name,
          description,
          subSchema: schema,
          rootSchema: outerSchema,
          arrayField: Array.isArray(fieldConfig) ? fieldConfig[0] : fieldConfig
        });

        knownObjects.components.push(...components);
        knownObjects.templates.push(...templates);

        return field;
      }
    }

    // enum?
    else if (!_.isUndefined(schema.enum)) {
      if (schema.type !== 'string') throw err(`Only string enums are supported.`, name);
      const description = buildDescription(schema);
      const options: { label: string; value: string }[] = schema.enum.map((value) => {
        return {
          label: value as string,
          value: safeEnumKey(value as string)
        };
      });

      const { field, components, templates } = processEnum({
        name,
        description,
        subSchema: schema,
        rootSchema: outerSchema,
        options,
        parentSchema
      });

      knownObjects.components.push(...components);
      knownObjects.templates.push(...templates);

      return field;
    }

    // ref?
    else if (!_.isUndefined(schema.$ref)) {
      const reffedSchema = getSchemaFn ? getSchemaFn(schema.$ref) : getSchema(schema.$ref);
      return buildType(name, reffedSchema, reffedSchema, knownObjects, parentSchema);
    }

    // const?
    else if (!_.isUndefined(schema.const)) {
      const description = buildDescription(schema);

      if (name !== typeResolutionField) {
        console.log('schema.const that is not type', schema);
        throw err(`The const keyword, not on property ${typeResolutionField}, is not supported.`);
      }

      const { field, components, templates } = processConst({
        name,
        description,
        subSchema: schema,
        rootSchema: outerSchema,
        parentSchema
      });

      knownObjects.components.push(...components);
      knownObjects.templates.push(...templates);

      return field;
    }

    // basic?
    else if (basicMapping(schema)) {
      const description = buildDescription(schema);

      const { field, components, templates } = processBasic({
        name,
        description,
        subSchema: schema,
        rootSchema: outerSchema,
        parentSchema
      });

      knownObjects.components.push(...components);
      knownObjects.templates.push(...templates);

      return field;
    }

    // ¯\_(ツ)_/¯
    else throw err(`The type ${schema.type} on property ${name} is unknown.`);
  }

  return schemaReducer;
}
