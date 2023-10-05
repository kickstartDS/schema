import { type JSONSchema } from 'json-schema-typed/draft-07';
import _ from 'lodash';

import { err, getSchemaName } from './helpers.js';

declare type MyAjv = import('ajv').default;

export interface IProcessInterface<T> {
  name: string;
  description: string;
  subSchema: JSONSchema.Interface;
  rootSchema: JSONSchema.Interface;
  parentSchema?: JSONSchema.Interface;
  fields?: T[];
  arrayField?: T;
  options?: {
    label: string;
    value: string;
  }[];
}

export interface IProcessFn<T> {
  (options: IProcessInterface<T>): T;
}

export interface ISchemaReducerOptions<T> {
  ajv: MyAjv;
  typeResolutionField: string;
  buildDescription: (d: JSONSchema.Interface) => string;
  safeEnumKey: (value: string) => string;
  basicMapping: (property: JSONSchema.Interface) => string;
  processObject: IProcessFn<T>;
  processRefArray: IProcessFn<T>;
  processObjectArray: IProcessFn<T>;
  processArray: IProcessFn<T>;
  processEnum: IProcessFn<T>;
  processConst: IProcessFn<T>;
  processBasic: IProcessFn<T>;
  schemaPost?: (schema: JSONSchema.Interface) => JSONSchema.Interface;
  getSchemaFn?: (id: string) => JSONSchema.Interface;
}

export function getSchemaReducer<T>({
  ajv,
  typeResolutionField,
  buildDescription,
  safeEnumKey,
  basicMapping,
  processObject,
  processRefArray,
  processObjectArray,
  processArray,
  processEnum,
  processConst,
  processBasic,
  schemaPost,
  getSchemaFn
}: ISchemaReducerOptions<T>): (knownTypes: T[], schema: JSONSchema.Interface) => T[] {
  function getSchema(id: string): JSONSchema.Interface {
    const validatorFunction = ajv.getSchema(id);

    if (!validatorFunction || !validatorFunction.schema)
      throw new Error(`Couldn't find schema for specified id string: ${id}`);

    return schemaPost
      ? schemaPost(validatorFunction.schema as JSONSchema.Interface)
      : (validatorFunction.schema as JSONSchema.Interface);
  }

  function schemaReducer(knownTypes: T[], schema: JSONSchema.Interface): T[] {
    const $id = schema.$id;
    if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.');

    const typeName = getSchemaName($id);
    const clonedSchema = schemaPost ? schemaPost(_.cloneDeep(schema)) : _.cloneDeep(schema);

    knownTypes.push(buildType(typeName, clonedSchema, clonedSchema));
    return knownTypes;
  }

  function buildType(
    propName: string,
    schema: JSONSchema.Interface,
    outerSchema: JSONSchema.Interface,
    parentSchema?: JSONSchema.Interface
  ): T {
    const name = propName;

    // all of the following JSON Schema composition keywords need to
    // be handled by the pre-processing, they'll throw if they get here

    // oneOf?
    if (!_.isUndefined(schema.oneOf)) {
      console.log('schema with oneOf', schema);
      throw err(`The type oneOf on property ${name} is not supported.`);
    }

    // anyOf?
    else if (!_.isUndefined(schema.anyOf)) {
      console.log('schema with anyOf', schema);
      throw err(`The type anyOf on property ${name} is not supported.`);
    }

    // allOf?
    else if (!_.isUndefined(schema.allOf)) {
      console.log('schema with allOf', schema);
      throw err(`The type allOf on property ${name} is not supported.`);
    }

    // not?
    else if (!_.isUndefined(schema.not)) {
      console.log('schema with not', schema);
      throw err(`The type not on property ${name} is not supported.`);
    }

    // object?
    else if (schema.type === 'object') {
      const description = buildDescription(schema);

      const fields = (): T[] =>
        !_.isEmpty(schema.properties)
          ? _.map<JSONSchema.Interface, T>(schema.properties, (prop: JSONSchema.Interface, fieldName) => {
              const objectSchema = _.cloneDeep(prop);

              return buildType(fieldName, objectSchema, outerSchema, schema);
            })
          : [];

      return processObject({
        name,
        description,
        subSchema: schema,
        rootSchema: outerSchema,
        fields: fields()
      });
    }

    // array?
    else if (schema.type === 'array') {
      if (schema.items && (schema.items as JSONSchema.Interface).anyOf) {
        const arraySchemas = (schema.items as JSONSchema.Interface).anyOf as JSONSchema.Interface[];
        const isRefArray = arraySchemas.length > 0 && arraySchemas.every((schema) => schema.$ref);
        const isObjectArray = arraySchemas.every((schema) => typeof schema === 'object');

        if (isRefArray) {
          const description = buildDescription(outerSchema);
          const fieldConfigs = arraySchemas.map((arraySchema) => {
            if (!arraySchema.$ref) throw new Error('Found array entry without $ref in ref array');

            const resolvedSchema = getSchemaFn ? getSchemaFn(arraySchema.$ref) : getSchema(arraySchema.$ref);
            return buildType(getSchemaName(resolvedSchema.$id), resolvedSchema, resolvedSchema, parentSchema);
          });

          return processRefArray({
            name,
            description,
            subSchema: schema,
            rootSchema: outerSchema,
            fields: fieldConfigs
          });
        } else if (isObjectArray) {
          const description = buildDescription(outerSchema);
          const fieldConfigs = arraySchemas.map((arraySchema) =>
            buildType(arraySchema.title?.toLowerCase() || '', arraySchema, outerSchema, parentSchema)
          );

          return processObjectArray({
            name,
            description,
            subSchema: schema,
            rootSchema: outerSchema,
            fields: fieldConfigs
          });
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
            parentSchema
          );
        } else {
          fieldConfig = buildType(name, arraySchema, outerSchema, parentSchema);
        }

        return processArray({
          name,
          description,
          subSchema: schema,
          rootSchema: outerSchema,
          arrayField: fieldConfig
        });
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

      return processEnum({
        name,
        description,
        subSchema: schema,
        rootSchema: outerSchema,
        options,
        parentSchema
      });
    }

    // ref?
    else if (!_.isUndefined(schema.$ref)) {
      const reffedSchema = getSchemaFn ? getSchemaFn(schema.$ref) : getSchema(schema.$ref);

      return buildType(name, reffedSchema, reffedSchema, parentSchema);
    }

    // const?
    else if (!_.isUndefined(schema.const)) {
      const description = buildDescription(schema);

      if (name !== typeResolutionField) {
        console.log('schema.const that is not type', schema);
        throw err(`The const keyword, not on property ${typeResolutionField}, is not supported.`);
      }

      return processConst({ name, description, subSchema: schema, rootSchema: outerSchema, parentSchema });
    }

    // basic?
    else if (basicMapping(schema)) {
      const description = buildDescription(schema);
      return processBasic({ name, description, subSchema: schema, rootSchema: outerSchema, parentSchema });
    }

    // ¯\_(ツ)_/¯
    else throw err(`The type ${schema.type} on property ${name} is unknown.`);
  }

  return schemaReducer;
}
