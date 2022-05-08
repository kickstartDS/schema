import { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import _ from 'lodash';
import { err } from './helpers';
import { NetlifyCmsField } from './@types';
import { safeEnumKey } from './safeEnumKey';
import Ajv from 'ajv';
import { getSchemaName, toPascalCase } from '@kickstartds/jsonschema-utils/dist/helpers';

const typeResolutionField = 'type';

// TODO pretty sure this is shared for all converters
interface TypeMapping {
  boolean: string;
  string: string;
  integer: string;
  array: string;
  object: string;
}

const mapping: TypeMapping = {
  boolean: 'boolean',
  string: 'string',
  integer: 'number',
  array: 'list',
  object: 'object',
};

const getInternalTypeDefinition = (type: string): NetlifyCmsField => {
  return {
    label: toPascalCase(typeResolutionField),
    name: typeResolutionField,
    widget: 'hidden',
    description: 'Internal type for interface resolution',
    default: type,
  }
}

const widgetMapping = (property: JSONSchema7) : string => {
  if (property.type === 'string' && property.enum && property.enum.length) {
    return 'select';
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'markdown'
  ) {
    return 'markdown';
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'image'
  ) {
    return 'image';
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'id'
  ) {
    return 'id';
  }

  return mapping[property.type as JSONSchema7TypeName];
};

// TODO check the generated NetlifyCmsField properties for all elements:
// * required -> this is not functional yet... needs to be evaluated intelligently,
//      because of schema nesting (schema > array > allOf > $ref > object, etc)
// * hint -> may be affected by the same challenge as `required`
export function getSchemaReducer(ajv: Ajv) {
  function schemaReducer(knownTypes: NetlifyCmsField[], schema: JSONSchema7): NetlifyCmsField[] {
    const $id = schema.$id
    if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.');

    const typeName = getSchemaName($id);
    const clonedSchema = _.cloneDeep(schema);
  
    knownTypes.push(buildType(typeName, clonedSchema, clonedSchema));
    return knownTypes;
  }

  function buildType(
    propName: string,
    schema: JSONSchema7,
    outerSchema: JSONSchema7,
  ): NetlifyCmsField {
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

      const fields = (): NetlifyCmsField[] =>
        !_.isEmpty(schema.properties)
          ? _.map(schema.properties, (prop: JSONSchema7, fieldName: string) => {
              const objectSchema = _.cloneDeep(prop);

              return buildType(
                fieldName,
                objectSchema,
                outerSchema,
              );
            })
          : [];

      const field: NetlifyCmsField = {
        label: toPascalCase(name),
        name,
        widget: widgetMapping(schema),
        fields: fields(),
        collapsed: true,
      };
        
      if (schema.default)
        field.default = schema.default as string;

      if (description)
        field.hint = description;

      field.required = schema.required?.includes(name) || false;
  
      return field;
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

          const field: NetlifyCmsField = {
            name,
            widget: 'list',
            types: fieldConfigs
          };

          if (outerSchema.default)
            field.default = schema.default as string;
          
          if (description)
            field.hint = description;
    
          field.required = outerSchema.required?.includes(name) || false;
          
          return field;
        } else if (isObjectArray) {
          const description = buildDescription(outerSchema);
          const fieldConfigs = arraySchemas.map((arraySchema) =>
            buildType(
              arraySchema.title?.toLowerCase() || '',
              arraySchema,
              outerSchema,
            )
          );

          const field: NetlifyCmsField = {
            name,
            widget: 'list',
            types: fieldConfigs,
          };

          if (outerSchema.default)
            field.default = schema.default as string;
          
          if (description)
            field.hint = description;
    
          field.required = outerSchema.required?.includes(name) || false;

          return field;
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

        const field: NetlifyCmsField = {
          label: toPascalCase(name),
          name,
          widget: 'list',
        };

        if (outerSchema.default)
          field.default = schema.default as string;
      
        if (description)
          field.hint = description;

        field.required = outerSchema.required?.includes(name) || false;
  
        if (fieldConfig && fieldConfig.fields)
          field.fields = fieldConfig.fields;
  
        return field;
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

      const field: NetlifyCmsField = {
        label: toPascalCase(name),
        name,
        widget: 'select',
        options,
      }

      if (schema.default)
        field.default = safeEnumKey(schema.default as string);

      if (description)
        field.hint = description;

      field.required = schema.required?.includes(name) || false;
  
      return field;
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
      if (name !== typeResolutionField) {
        console.log('schema.const that is not type', schema);
        throw err(`The const keyword, not on property ${typeResolutionField}, is not supported.`);
      }
      return getInternalTypeDefinition(schema.const as string)
    }
  
    // basic?
    else if (widgetMapping(schema)) {
      const description = buildDescription(schema);
      const widget = widgetMapping(schema);
  
      const field: NetlifyCmsField = {
        label: toPascalCase(name),
        name,
        widget,
      };
  
      if (widget === 'number')
        field.valueType = 'int';

      if (schema.default)
        field.default = schema.default as string;

      if (description)
        field.hint = description;

      field.required = outerSchema.required?.includes(name) || false;
  
      return field;
    }
  
    // ¯\_(ツ)_/¯
    else throw err(`The type ${schema.type} on property ${name} is unknown.`);
  };

  return schemaReducer;
}

function buildDescription(d: any): string | undefined {
  return d.description || d.title || undefined;
}
