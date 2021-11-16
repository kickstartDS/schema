import { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import _ from 'lodash';
import { err } from './helpers';
import { safeEnumKey } from './safeEnumKey';
import { Field, ObjectField, ArrayField, StringField } from './@types';
import Ajv from 'ajv';
import * as path from 'path';

const typeResolutionField = 'type';

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

const getInternalTypeDefinition = (type: string): any => {
  return {
    name: typeResolutionField,
    type: 'string',
    hidden: true,
    description: 'Internal type for interface resolution',
    default: type,
  }
}

const widgetMapping = (property: JSONSchema7, name: string) : Field => {
  // const field: Field = {
  //   name,
  //   type: widget,
  //   title: toPascalCase(name),
  // };

  if (property.type === 'string' && property.enum && property.enum.length) {
    return {
      name,
      type: 'string',
      title: toPascalCase(name)
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'markdown'
  ) {
    return {
      name,
      type: 'text',
      title: toPascalCase(name)
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'image'
  ) {
    return {
      name,
      type: 'image',
      title: toPascalCase(name)
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'id'
  ) {
    return {
      name,
      type: 'string',
      title: toPascalCase(name)
    };
  }

  return {
    name,
    type: mapping[property.type as JSONSchema7TypeName],
    title: toPascalCase(name)
  };
};

let allDefinitions: JSONSchema7[];

function toPascalCase(text: string): string {
  return text.replace(/(^\w|-\w)/g, clearAndUpper);
}

function clearAndUpper(text: string): string {
  return text.replace(/-/, " ").toUpperCase();
}

function getLayeredRefId(ajv: Ajv, refId: string, reffingSchemaId: string): string {
  if (!refId.includes('frontend.ruhmesmeile.com')) return refId;

  const component = path.basename(refId);
  const layeredComponent = Object.keys(ajv.schemas).filter((schemaId) => schemaId.includes(component) && !schemaId.includes('frontend.ruhmesmeile.com'))

  return layeredComponent.length > 0 && (reffingSchemaId.includes('frontend.ruhmesmeile.com') || (!refId.includes('section.schema.json') && reffingSchemaId.includes('section.schema.json')))
    ? layeredComponent[0]
    : refId;
}

export function getSchemaName(schemaId: string | undefined): string {
  return schemaId && schemaId.split('/').pop()?.split('.').shift() || '';
};

export function schemaGenerator(ajv: Ajv, definitions: JSONSchema7[], schemas: JSONSchema7[]): Field[] {
  allDefinitions = definitions;
  
  function buildConfig(
    propName: string,
    schema: JSONSchema7,
    objectFields: Field[],
    outerRun: boolean = false,
    outerSchema: JSONSchema7,
    componentSchemaId: string = '',
  ): Field {
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

      const field: ObjectField = buildConfig(name, objectSchema, objectFields, outerSchema.$id?.includes('section.schema.json') ? true : false, schema.$id?.includes('section.schema.json') ? schema : outerSchema, objectSchema.$id || componentSchemaId) as ObjectField;
      
      // TODO re-check button exemption, type clash was resolved! Pretty sure that's the reason for the exclusion
      if ((contentComponent || sectionComponent) && field && field.fields && name !== 'button' && name !== 'section') {
        if (!Object.values(field.fields).find((field) => field.name === 'type')) {
          field.fields.push(getInternalTypeDefinition(name));
        }
      }

      return field
    }
  
    // not?
    else if (!_.isUndefined(schema.not)) {
      console.log('schema with not', schema);
      throw err(`The type not on property ${name} is not supported.`);
    }
  
    // object?
    else if (schema.type === 'object') {
      const description = buildDescription(schema);

      const fields = (): Field[] =>
        !_.isEmpty(schema.properties)
          ? _.map(schema.properties, (prop: JSONSchema7, fieldName: string) => {
              const objectSchema = _.cloneDeep(prop);
              const isOuterRun = outerSchema.$id?.includes('section.schema.json') ? true : false;
              const schemaOuter = schema.$id?.includes('section.schema.json') ? schema : outerSchema;

              return buildConfig(fieldName, objectSchema, objectFields, isOuterRun, schemaOuter, objectSchema.$id || componentSchemaId);
            })
          : [];

      const field: ObjectField = {
        name,
        type: 'object',
        title: toPascalCase(name),
        fields: fields(),
      };

      // TODO re-check button exemption, type clash was resolved! Pretty sure that's the reason for the exclusion
      if ((contentComponent || sectionComponent) && field && field.fields && name !== 'button' && name !== 'section') {
        if (!Object.values(field.fields).find((field) => field.name === 'type')) {
          field.fields.push(getInternalTypeDefinition(name));
        }
      }
        
      if (schema.default)
        field.initialValue = schema.default as string;

      if (description)
        field.description = description;

      // TODO this is a function in Sanity, needs to be added:
      // e.g. https://www.sanity.io/docs/string-type#required()-f5fd99d2b4c6
      // field.required = schema.required?.includes(name) || false;
  
      return field;
    }
  
    // array?
    else if (schema.type === 'array') {
      // anyOf -> convert all items
      if (schema.items && (schema.items as JSONSchema7).anyOf) {
        const arraySchemas = (schema.items as JSONSchema7).anyOf as JSONSchema7[];
        const isRefArray = arraySchemas.length > 0 && arraySchemas.every((schema) => schema.$ref);
        const isObjectArray = arraySchemas.every((schema) => (typeof schema === 'object'));

        if (isRefArray) {
          // only hit for `page > content`
          const description = buildDescription(outerSchema);
          const fieldConfigs = arraySchemas.map((arraySchema) => {
            const resolvedSchema = ajv.getSchema(getLayeredRefId(ajv, arraySchema.$ref as string, componentSchemaId))?.schema as JSONSchema7;
            return buildConfig(getSchemaName(resolvedSchema.$id), resolvedSchema, objectFields, outerSchema.$id?.includes('section.schema.json') ? true : false, resolvedSchema, resolvedSchema.$id || componentSchemaId);
          });

          const field: ArrayField = {
            name,
            type: 'array',
            title: toPascalCase(name),
            of: fieldConfigs
          };

          if (outerSchema.default)
            field.initialValue = schema.default as string;
          
          if (description)
            field.description = description;
    
          // TODO this is a function in Sanity, needs to be added:
          // e.g. https://www.sanity.io/docs/string-type#required()-f5fd99d2b4c6
          // field.required = outerSchema.required?.includes(name) || false;
          
          return field;
        } else if (isObjectArray) {
          const description = buildDescription(outerSchema);
          const fieldConfigs = arraySchemas.map((arraySchema) =>
            buildConfig(arraySchema.title?.toLowerCase() || '', arraySchema, objectFields, outerSchema.$id?.includes('section.schema.json') ? true : false, schema.$id?.includes('section.schema.json') ? schema : outerSchema, arraySchema.$id || componentSchemaId)
          );

          const field: ArrayField = {
            name,
            type: 'array',
            title: toPascalCase(name),
            of: fieldConfigs,
          };

          if (outerSchema.default)
            field.initialValue = schema.default as string;
          
          if (description)
            field.description = description;
  
          // TODO this is a function in Sanity, needs to be added:
          // e.g. https://www.sanity.io/docs/string-type#required()-f5fd99d2b4c6
          // field.required = outerSchema.required?.includes(name) || false;

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
        const isOuterRun = outerSchema.$id?.includes('section.schema.json') ? true : false;
        const schemaOuter = schema.$id?.includes('section.schema.json') ? schema : outerSchema;

        let fieldConfig;
        if (arraySchema.$ref) {
          const resolvedSchema = ajv.getSchema(getLayeredRefId(ajv, arraySchema.$ref as string, componentSchemaId))?.schema as JSONSchema7;
          fieldConfig = buildConfig(getSchemaName(resolvedSchema.$id), resolvedSchema, objectFields, true, schemaOuter, resolvedSchema.$id || componentSchemaId);
        } else {
          fieldConfig = buildConfig(name, arraySchema, objectFields, isOuterRun, schemaOuter, arraySchema.$id || componentSchemaId);
        }

        const field: ArrayField = {
          name,
          type: 'array',
          title: toPascalCase(name),
          of: [],
        };

        if (outerSchema.default)
          field.initialValue = schema.default as string;
      
        if (description)
          field.description = description;

        // TODO this is a function in Sanity, needs to be added:
        // e.g. https://www.sanity.io/docs/string-type#required()-f5fd99d2b4c6
        // field.required = outerSchema.required?.includes(name) || false;
  
        if (fieldConfig && fieldConfig.type === 'object' && (fieldConfig as ObjectField).fields)
          field.of = (fieldConfig as ObjectField).fields;
  
        return field;
      }
    }
  
    // enum?
    else if (!_.isUndefined(schema.enum)) {
      if (schema.type !== 'string') throw err(`Only string enums are supported.`, name);
      const description = buildDescription(schema);
      const options: { title: string, value: string }[] = schema.enum.map((value) => {
        return {
          title: value as string,
          value: safeEnumKey(value as string),
        };
      });

      const field: StringField = {
        name,
        type: 'string',
        title: toPascalCase(name),
        options: {
          list: options
        },
      };

      if (schema.default)
        field.initialValue = safeEnumKey(schema.default as string);

      if (description)
        field.description = description;

      // TODO this is a function in Sanity, needs to be added:
      // e.g. https://www.sanity.io/docs/string-type#required()-f5fd99d2b4c6
      // field.required = schema.required?.includes(name) || false;
  
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

        return buildConfig(reffedPropertyName as string, reffedProperty, objectFields, outerSchema.$id?.includes('section.schema.json') ? true : false, schema.$id?.includes('section.schema.json') ? schema : outerSchema, reffedProperty.$id || componentSchemaId);
      } else {
        const reffedSchema = ajv.getSchema(getLayeredRefId(ajv, schema.$ref as string, componentSchemaId))?.schema as JSONSchema7;
        return buildConfig(name, reffedSchema, objectFields, outerSchema.$id?.includes('section.schema.json') ? true : false, schema.$id?.includes('section.schema.json') ? schema : outerSchema, reffedSchema.$id || componentSchemaId);
      }
    }
  
    // basic?
    else if (widgetMapping(schema, name)) {
      const description = buildDescription(schema);
      const field = widgetMapping(schema, name);
  
      // TODO re-check this
      // if (widget === 'number')
      //   field.valueType = 'int';

      if (schema.default)
        field.initialValue = schema.default as string;

      if (description)
        field.description = description;

      // TODO this is a function in Sanity, needs to be added:
      // e.g. https://www.sanity.io/docs/string-type#required()-f5fd99d2b4c6
      // field.required = outerSchema.required?.includes(name) || false;
  
      return field;
    }
  
    // ¯\_(ツ)_/¯
    else throw err(`The type ${schema.type} on property ${name} is unknown.`);
  }

  const sanityFields: Field[] = schemas.map((schema) => {
    const $id = schema.$id
    if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.');
    const typeName = getSchemaName($id);
    return buildConfig(typeName, schema, sanityFields, true, schema, schema.$id);
  });

  return sanityFields;
}

function buildDescription(d: any): string | undefined {
  return d.description || d.title || undefined;
}
