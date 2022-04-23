import { JSONSchema7 } from 'json-schema';
import _ from 'lodash';
import { err } from './helpers';
import { safeEnumKey } from './safeEnumKey';
import { Input } from '@builder.io/sdk/dist/src/builder.class';
import Ajv from 'ajv';
import { getLayeredRefId, getSchemaName } from '@kickstartds/jsonschema-utils/dist/helpers';

const typeResolutionField = 'type';

/**

https://www.builder.io/c/docs/custom-react-components#input-types

'string'
'number'
'boolean'
'longText' // String type but with a multiline text field editor
'richText' // Displays a rich text editor and provides the value as html
'file' // Uploads a file and provides the value as a url string
'color'
'date'
'email'
'object'
'list'
'reference' // displays a content entry picker to reference

 */

const getInternalTypeDefinition = (type: string): Input => {
  return {
    name: typeResolutionField,
    description: 'Internal type for interface resolution',
    type: 'string',
    hideFromUI: true,
  }
};

const scalarMapping = (property: JSONSchema7, propertyName: string) : Input => {
  if (property.type === 'string' && property.enum && property.enum.length) {
    return {
      friendlyName: propertyName,
      name: propertyName.replace('-', '_'),
      defaultValue: property.default,
      enum: property.enum.map((value) => value as string) || [],
      type: 'string',
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'markdown'
  ) {
    return {
      friendlyName: propertyName,
      name: propertyName.replace('-', '_'),
      defaultValue: property.default,
      type: 'richText',
      richText: true,
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'color'
  ) {
    return {
      friendlyName: propertyName,
      name: propertyName.replace('-', '_'),
      defaultValue: property.default,
      type: 'color',
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'image'
  ) {
    return {
      friendlyName: propertyName,
      name: propertyName.replace('-', '_'),
      defaultValue: property.default,
      allowedFileTypes: ['jpeg', 'png', 'gif', 'svg', 'jpg'],
      type: 'file',
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'date'
  ) {
    return {
      friendlyName: propertyName,
      name: propertyName.replace('-', '_'),
      defaultValue: property.default,
      type: 'date',
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'id'
  ) {
    return {
      friendlyName: propertyName,
      name: propertyName.replace('-', '_'),
      defaultValue: property.default,
      type: 'string',
    };
  }

  if (property.type === 'string') {
    return {
      friendlyName: propertyName,
      name: propertyName.replace('-', '_'),
      defaultValue: property.default,
      type: 'string',
    };
  }

  if (property.type === 'integer' || property.type === 'number') {
    return {
      friendlyName: propertyName,
      name: propertyName.replace('-', '_'),
      defaultValue: property.default,
      type: 'number',
    };
  }

  if (property.type === 'boolean') {
    return {
      friendlyName: propertyName,
      name: propertyName.replace('-', '_'),
      defaultValue: property.default,
      type: 'boolean',
    }
  }

  console.log('unsupported property in scalarMapping', property);
  throw err(`The property property ${JSON.stringify(property, null, 2)} is not supported.`);
};

let allDefinitions: JSONSchema7[];

function toPascalCase(text: string): string {
  return text.replace(/(^\w|-\w)/g, clearAndUpper);
}

function clearAndUpper(text: string): string {
  return text.replace(/-/, " ").toUpperCase();
}

export function config(ajv: Ajv, definitions: JSONSchema7[], schemas: JSONSchema7[]): Input[] {
  allDefinitions = definitions;
  
  function buildConfig(
    propName: string,
    schema: JSONSchema7,
    contentFields: Input[],
    outerRun: boolean = false,
    outerSchema: JSONSchema7,
    componentSchemaId: string = '',
  ): Input {
    const sectionComponent = (outerSchema.$id?.includes('section.schema.json'));
    const contentComponent = outerRun && !sectionComponent;
    const name = propName;

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
      const reduceSchemaAllOf = (allOfs: JSONSchema7[], outerComponentSchemaId: string): JSONSchema7 => {
        return allOfs.reduce((finalSchema: JSONSchema7, allOf: JSONSchema7) => {
          const mergeSchemaAllOf = (allOf: JSONSchema7): JSONSchema7 => {
            if (!_.isUndefined(allOf.$ref)) {
              if (allOf.$ref.includes('#/definitions/')) {
                const definitionName = allOf.$ref.split('/').pop() || '';
                const definition = _.cloneDeep(allDefinitions[definitionName]);
                if (definition.allOf) {
                  return _.merge(finalSchema, reduceSchemaAllOf(definition.allOf, outerComponentSchemaId))
                }
                return _.merge(finalSchema, definition);
              } else {
                const reffedSchema = _.cloneDeep(ajv.getSchema(getLayeredRefId(ajv, allOf.$ref as string, outerComponentSchemaId))?.schema as JSONSchema7);
                if (reffedSchema.allOf) {
                  return _.merge(finalSchema, reduceSchemaAllOf(reffedSchema.allOf as JSONSchema7[], reffedSchema.$id as string))
                }
                return _.merge(finalSchema, reffedSchema);
              }
            } else {
              return _.merge(finalSchema, allOf);
            }
          };
  
          return mergeSchemaAllOf(allOf);
        }, { } as JSONSchema7);
      };
  
      const objectSchema = reduceSchemaAllOf(schema.allOf as JSONSchema7[], componentSchemaId);
      if (schema.properties)
        objectSchema.properties = _.merge(objectSchema.properties, schema.properties);

      const field: Input = buildConfig(name, objectSchema, contentFields, outerSchema.$id?.includes('section.schema.json') ? true : false, schema.$id?.includes('section.schema.json') ? schema : outerSchema, objectSchema.$id || componentSchemaId) as Input;
      
      if ((contentComponent || sectionComponent) && field && field.subFields && name !== 'button' && name !== 'section') {
        if (!Object.values(field.subFields).find((field) => field.name === 'type')) {
          (field.subFields as Input[]).push(getInternalTypeDefinition(name));
        }
      }

      return field;
    }
  
    // not?
    else if (!_.isUndefined(schema.not)) {
      console.log('schema with not', schema);
      throw err(`The type not on property ${name} is not supported.`);
    }
  
    // object?
    else if (schema.type === 'object') {
      // TODO re-add description, add defaults
      // const description = buildDescription(schema);

      const fields = (): Input[] =>
        !_.isEmpty(schema.properties)
          ? _.map(schema.properties, (prop: JSONSchema7, fieldName: string) => {
              const objectSchema = _.cloneDeep(prop);
              const isOuterRun = outerSchema.$id?.includes('section.schema.json') ? true : false;
              const schemaOuter = schema.$id?.includes('section.schema.json') ? schema : outerSchema;

              return buildConfig(fieldName, objectSchema, contentFields, isOuterRun, schemaOuter, objectSchema.$id || componentSchemaId);
            })
          : [];

      const field: Input = {
        friendlyName: toPascalCase(name),
        type: 'object',
        defaultValue: {},
        name: name.replace('-', '_'),
        subFields: fields(),
      };

      if ((contentComponent || sectionComponent) && field && field.subFields && name !== 'button' && name !== 'section') {
        if (!Object.values(field.subFields).find((field) => field.name === 'type')) {
          (field.subFields as Input[]).push(getInternalTypeDefinition(name));
        }
      }
        
      return field;
    }
  
    // array?
    else if (schema.type === 'array') {
      // anyOf -> convert all items
      if(schema.items && (schema.items as JSONSchema7).anyOf) {
        const arraySchemas = (schema.items as JSONSchema7).anyOf as JSONSchema7[];
        const isRefArray = arraySchemas.length > 0 && arraySchemas.every((schema) => schema.$ref);
        const isObjectArray = arraySchemas.every((schema) => (typeof schema === 'object'));

        if (isRefArray) {
          // only hit for `page > content`
          // TODO re-add description, add defaults
          // const description = buildDescription(outerSchema);
          const fieldConfigs = arraySchemas.map((arraySchema) => {
            const resolvedSchema = ajv.getSchema(getLayeredRefId(ajv, arraySchema.$ref as string, componentSchemaId))?.schema as JSONSchema7;
            return buildConfig(getSchemaName(resolvedSchema.$id), resolvedSchema, contentFields, outerSchema.$id?.includes('section.schema.json') ? true : false, resolvedSchema, resolvedSchema.$id || componentSchemaId) as Input;
          });

          const field: Input = {
            name: name.replace('-', '_'),
            type: 'list',
            defaultValue: [],
            friendlyName: name,
            subFields: fieldConfigs
          };

          return field;
        } else if (isObjectArray) {
          // TODO re-add description, add defaults
          // const description = buildDescription(outerSchema);
          const fieldConfigs = arraySchemas.map((arraySchema) =>
            buildConfig(arraySchema.title?.toLowerCase() || '', arraySchema, contentFields, outerSchema.$id?.includes('section.schema.json') ? true : false, schema.$id?.includes('section.schema.json') ? schema : outerSchema, arraySchema.$id || componentSchemaId) as Input
          );

          const field: Input = {
            name: name.replace('-', '_'),
            type: 'list',
            defaultValue: [],
            friendlyName: name,
            subFields: fieldConfigs,
          };

          return field;
        } else {
          throw err(`Incompatible anyOf declaration for array with type ${schema.type} on property ${name}.`);
        }
      } else if (schema.items && (schema.items as JSONSchema7).oneOf) {
        console.log('schema with array items using oneOf', schema);
        throw err(`The type oneOf on array items of property ${name} is not supported.`);
      } else {
        // TODO re-add description, add defaults
        // const description = buildDescription(outerSchema);
        const arraySchema = schema.items as JSONSchema7;
        const isOuterRun = outerSchema.$id?.includes('section.schema.json') ? true : false;
        const schemaOuter = schema.$id?.includes('section.schema.json') ? schema : outerSchema;

        let fieldConfig;
        if (arraySchema.$ref) {
          const resolvedSchema = ajv.getSchema(getLayeredRefId(ajv, arraySchema.$ref as string, componentSchemaId))?.schema as JSONSchema7;
          fieldConfig = buildConfig(getSchemaName(resolvedSchema.$id), resolvedSchema, contentFields, true, schemaOuter, resolvedSchema.$id || componentSchemaId) as Input;
        } else {
          fieldConfig = buildConfig(name, arraySchema, contentFields, isOuterRun, schemaOuter, arraySchema.$id || componentSchemaId) as Input;
        }

        const field: Input = {
          friendlyName: toPascalCase(name),
          name,
          defaultValue: [],
          type: 'list',
          subFields: fieldConfig && fieldConfig.subFields || [],
        };

        return field;
      }
    }
  
    // enum?
    else if (!_.isUndefined(schema.enum)) {
      if (schema.type !== 'string') throw err(`Only string enums are supported.`, name);
      // TODO re-add description, add defaults
      // const description = buildDescription(schema);
      const options: { label: string, value: string }[] = schema.enum.map((value) => {
        return {
          label: value as string,
          value: safeEnumKey(value as string),
        };
      });

      const field: Input = {
        friendlyName: toPascalCase(name),
        name: name.replace('-', '_'),
        defaultValue: schema.default,
        enum: schema.enum.map((value) => value as string) || [],
        type: 'string',
      }

      return field;
    }
  
    // ref?
    else if (!_.isUndefined(schema.$ref)) {
      if (schema.$ref.includes('#/definitions/')) {
        const reffedSchemaId = schema.$ref.includes('http')
          ? schema.$ref.split('#').shift()
          : outerSchema.$id;
        const reffedPropertyName = schema.$ref.includes('http')
          ? schema.$ref.split('#').pop()?.split('/').pop()
          : schema.$ref.split('/').pop();

        const reffedSchema = ajv.getSchema(getLayeredRefId(ajv, reffedSchemaId as string, componentSchemaId))?.schema as JSONSchema7;
        const reffedProperty = reffedSchema && reffedSchema.definitions ? reffedSchema.definitions[reffedPropertyName as string] as JSONSchema7 : allDefinitions[reffedPropertyName as string] as JSONSchema7;

        return buildConfig(reffedPropertyName as string, reffedProperty, contentFields, outerSchema.$id?.includes('section.schema.json') ? true : false, schema.$id?.includes('section.schema.json') ? schema : outerSchema, reffedProperty.$id || componentSchemaId);
      } else {
        const reffedSchema = ajv.getSchema(getLayeredRefId(ajv, schema.$ref as string, componentSchemaId))?.schema as JSONSchema7;
        return buildConfig(name, reffedSchema, contentFields, outerSchema.$id?.includes('section.schema.json') ? true : false, schema.$id?.includes('section.schema.json') ? schema : outerSchema, reffedSchema.$id || componentSchemaId);
      }
    }
  
    // basic?
    else if (scalarMapping(schema, name)) {
      // TODO re-add description, add defaults
      // const description = buildDescription(schema);
  
      return scalarMapping(schema, name);
    }
  
    // ¯\_(ツ)_/¯
    else throw err(`The type ${schema.type} on property ${name} is unknown.`);
  }

  const contentFields: Input[] = [];
  // TODO don't hardcode page schema here
  const pageSchema = schemas.find((schema) => schema.$id?.includes('page.schema.json')) as JSONSchema7;

  const $id = pageSchema.$id
  if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.');
  const typeName = getSchemaName($id);
  contentFields.push(buildConfig(typeName, pageSchema, contentFields, true, pageSchema, pageSchema.$id));

  return contentFields;
}

function buildDescription(d: any): string | undefined {
  return d.description || d.title || undefined;
}
