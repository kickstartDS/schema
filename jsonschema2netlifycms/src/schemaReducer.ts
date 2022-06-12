import { JSONSchema7 } from 'json-schema';
import _ from 'lodash';
import { err } from './helpers';
import Ajv from 'ajv';
import { getSchemaName } from '@kickstartds/jsonschema-utils/dist/helpers';

export interface processInterface<T> {
  name: string,
  description: string,
  subSchema: JSONSchema7,
  rootSchema: JSONSchema7,
  fields?: T[],
  arrayField?: T,
  options?: {
    label: string;
    value: string;
  }[],
};

export interface processFn<T> {
  (options: processInterface<T>): T
};

export interface schemaReducerOptions<T> {
  ajv: Ajv,
  typeResolutionField: string,
  buildDescription: (d: any) => string | undefined,
  safeEnumKey: (value: string) => string,
  basicMapping: (property: JSONSchema7) => string,
  processObject: processFn<T>,
  processRefArray: processFn<T>,
  processObjectArray: processFn<T>,
  processArray: processFn<T>,
  processEnum: processFn<T>,
  processConst: processFn<T>,
  processBasic: processFn<T>,
  schemaPost?: (schema: JSONSchema7) => JSONSchema7,
};

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
}: schemaReducerOptions<T>) {
  function schemaReducer(knownTypes: T[], schema: JSONSchema7): T[] {
    const $id = schema.$id
    if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.');

    const typeName = getSchemaName($id);
    const clonedSchema = schemaPost
      ? schemaPost(_.cloneDeep(schema))
      : _.cloneDeep(schema);
  
    knownTypes.push(buildType(typeName, clonedSchema, clonedSchema));
    return knownTypes;
  }

  function buildType(
    propName: string,
    schema: JSONSchema7,
    outerSchema: JSONSchema7,
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
          ? _.map(schema.properties, (prop: JSONSchema7, fieldName) => {
              const objectSchema = _.cloneDeep(prop);

              return buildType(
                fieldName,
                objectSchema,
                outerSchema,
              );
            })
          : [];
  
      return processObject({ name, description, subSchema: schema, rootSchema: outerSchema, fields: fields() });
    }

    // array?
    else if (schema.type === 'array') {
      if (schema.items && (schema.items as JSONSchema7).anyOf) {
        const arraySchemas = (schema.items as JSONSchema7).anyOf as JSONSchema7[];
        const isRefArray = arraySchemas.length > 0 && arraySchemas.every((schema) => schema.$ref);
        const isObjectArray = arraySchemas.every((schema) => (typeof schema === 'object'));

        if (isRefArray) {
          const description = buildDescription(outerSchema);
          const fieldConfigs = arraySchemas.map((arraySchema) => {
            const resolvedSchema = ajv.getSchema(arraySchema.$ref)?.schema as JSONSchema7;
            return buildType(
              getSchemaName(resolvedSchema.$id),
              resolvedSchema,
              resolvedSchema,
            );
          });

          return processRefArray({ name, description, subSchema: schema, rootSchema: outerSchema, fields: fieldConfigs });
        } else if (isObjectArray) {
          const description = buildDescription(outerSchema);
          const fieldConfigs = arraySchemas.map((arraySchema) =>
            buildType(
              arraySchema.title?.toLowerCase() || '',
              arraySchema,
              outerSchema,
            )
          );

          return processObjectArray({ name, description, subSchema: schema, rootSchema: outerSchema, fields: fieldConfigs });
        } else {
          throw err(`Incompatible anyOf declaration for array with type ${schema.type} on property ${name}.`);
        }
      } else if (schema.items && (schema.items as JSONSchema7).oneOf) {
        console.log('schema with array items using oneOf', schema);
        throw err(`The type oneOf on array items of property ${name} is not supported.`);
      } else {
        const description = buildDescription(outerSchema);
        const arraySchema = schema.items as JSONSchema7;

        let fieldConfig;
        if (arraySchema.$ref) {
          const resolvedSchema = ajv.getSchema(arraySchema.$ref)?.schema as JSONSchema7;
          fieldConfig = buildType(
            getSchemaName(resolvedSchema.$id),
            resolvedSchema,
            resolvedSchema,
          );
        } else {
          fieldConfig = buildType(
            name,
            arraySchema,
            outerSchema,
          );
        }

        return processArray({ name, description, subSchema: schema, rootSchema: outerSchema, arrayField: fieldConfig });
      }
    }

    // enum?
    else if (!_.isUndefined(schema.enum)) {
      if (schema.type !== 'string') throw err(`Only string enums are supported.`, name);
      const description = buildDescription(schema);
      const options: { label: string, value: string }[] = schema.enum.map((value) => {
        return {
          label: value as string,
          value: safeEnumKey(value as string),
        };
      });

      return processEnum({ name, description, subSchema: schema, rootSchema: outerSchema, options });
    }

    // ref?
    else if (!_.isUndefined(schema.$ref)) {
      const reffedSchema = ajv.getSchema(schema.$ref)?.schema as JSONSchema7;

      return buildType(
        name,
        reffedSchema,
        reffedSchema,
      );
    }

    // const?
    else if (!_.isUndefined(schema.const)) {
      const description = buildDescription(schema);

      if (name !== typeResolutionField) {
        console.log('schema.const that is not type', schema);
        throw err(`The const keyword, not on property ${typeResolutionField}, is not supported.`);
      }

      return processConst({ name, description, subSchema: schema, rootSchema: outerSchema });
    }

    // basic?
    else if (basicMapping(schema)) {
      const description = buildDescription(schema);
      return processBasic({ name, description, subSchema: schema, rootSchema: outerSchema });
    }

    // ¯\_(ツ)_/¯
    else throw err(`The type ${schema.type} on property ${name} is unknown.`);
  };

  return schemaReducer;
}
