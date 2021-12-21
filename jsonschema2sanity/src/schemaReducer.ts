import { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import _ from 'lodash';
import { err } from './helpers';
import { safeEnumKey } from './safeEnumKey';
import { Field, ObjectField, ArrayField, StringField, GetSchema } from './@types';
import Ajv from 'ajv';
import * as path from 'path';
import jsonPointer from 'json-pointer';

interface TypeMapping {
  boolean: string;
  string: string;
  integer: string;
  array: string;
  object: string;
}

interface SanityJSONSchema extends JSONSchema7 {
  $id: string;
  properties: {
    fields: JSONSchema7;
    preview?: JSONSchema7;
  }
}

const mapping: TypeMapping = {
  boolean: 'boolean',
  string: 'string',
  integer: 'number',
  array: 'list',
  object: 'object',
};

const widgetMapping = (property: JSONSchema7, name: string, title: string): Field => {
  // const field: Field = {
  //   name,
  //   type: widget,
  //   title: toPascalCase(name),
  // };

  if (property.const) {
    return {
      name,
      type: 'string',
      title,
      initialValue: property.const,
      hidden: true,
      readOnly: true,
    }
  }

  if (property.type === 'string' && property.enum && property.enum.length) {
    return {
      name,
      type: 'string',
      title,
    };
  }

  if (
    property.type === 'string' &&
    property.format &&
    property.format === 'markdown'
  ) {
    return {
      name,
      type: 'array',
      of: [{ type: "block" }],
      title,
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
      options: {
        hotspot: true,
      },
      title,
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
      title,
    };
  }

  return {
    name,
    type: mapping[property.type as JSONSchema7TypeName],
    title,
  };
};

let allDefinitions: JSONSchema7[];

function toPascalCase(text: string): string {
  return text && text.replace(/(^\w|-\w)/g, clearAndUpper)
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
  const basename = (schemaId && schemaId.split('/').pop()?.split('.').shift()) || ''
  const trace = basename.split('-')
  if (trace.length > 1) {
    // handle "virtual" schema ids
    // e.g. `visual-box-headline.schema.json` will be converted to `box_headline`
    return trace.slice(1).join('_')
  } else {
    return trace[0]
  }
};

export function schemaGenerator(ajv: Ajv, definitions: JSONSchema7[], schemas: JSONSchema7[], getSchema: GetSchema): Field[] {
  allDefinitions = definitions;

  function buildConfig(
    schema: JSONSchema7,
    outerSchema: JSONSchema7,
    componentSchemaId: string = '',
    propPath: string[] = [],
    expandPropPath = true,
  ): Field {
    const name = propPath.join('_');
    const title = schema.title || toPascalCase(propPath[propPath.length - 1])

    // oneOf?
    if (!_.isUndefined(schema.oneOf)) {
      console.log('schema with oneOf', schema);
      throw err(`The type oneOf on property ${name} is not supported.`);
    }

    // anyOf?
    else if (!_.isUndefined(schema.anyOf)) {
      console.log('schema with anyOf', schema);
      throw err(`The type anyOf on property ${name} is not supported. This should've been compiled in the processing step before this one!`);
    }

    // allOf?
    else if (!_.isUndefined(schema.allOf)) {
      console.log('schema with allOf', schema);
      throw err(`The type allOf on property ${name} is not supported. This should've been compiled in the processing step before this one!`);
    }

    // not?
    else if (!_.isUndefined(schema.not)) {
      console.log('schema with not', schema);
      throw err(`The type not on property ${name} is not supported.`);
    }

    // object?
    else if (schema.type === 'object') {
      const fields = (): Field[] =>
        !_.isEmpty(schema.properties)
          ? _.map(schema.properties, (prop: JSONSchema7, fieldName: string) => {
              const objectSchema = _.cloneDeep(prop);
              const schemaOuter = schema.$id?.includes('section.schema.json') ? schema : outerSchema;

              return buildConfig(objectSchema, schemaOuter, objectSchema.$id || componentSchemaId, propPath.concat(fieldName), false);
            })
          : []

      const field: ObjectField = {
        name,
        type: 'object',
        title,
        description: buildDescription(schema),
        fields: fields(),
      }

      // TODO this needs to be refined (probably add explicitly in Sanity schema layering)
      // if (schema.default)
      //   field.initialValue = schema.default as string;

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
          const fieldConfigs = arraySchemas.map((arraySchema) => {
            const resolvedSchema = getSchema(getLayeredRefId(ajv, arraySchema.$ref as string, componentSchemaId));
            return buildConfig(resolvedSchema, resolvedSchema, resolvedSchema.$id || componentSchemaId, propPath);
          });

          const field: ArrayField = {
            name,
            type: 'array',
            title,
            description: buildDescription(outerSchema),
            of: fieldConfigs
          };

          // TODO this needs to be refined (probably add explicitly in Sanity schema layering)
          // if (outerSchema.default)
          //   field.initialValue = schema.default as string;

          // TODO this is a function in Sanity, needs to be added:
          // e.g. https://www.sanity.io/docs/string-type#required()-f5fd99d2b4c6
          // field.required = outerSchema.required?.includes(name) || false;

          return field;
        } else if (isObjectArray) {
          const fieldConfigs = arraySchemas.map((arraySchema) =>
            buildConfig(arraySchema, schema.$id?.includes('section.schema.json') ? schema : outerSchema, arraySchema.$id || componentSchemaId, propPath)
          );

          const field: ArrayField = {
            name,
            type: 'array',
            title,
            description: buildDescription(outerSchema),
            of: fieldConfigs,
          };

          // TODO this needs to be refined (probably add explicitly in Sanity schema layering)
          // if (outerSchema.default)
          //   field.initialValue = schema.default as string;

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
        const arraySchema = schema.items as JSONSchema7;
        const schemaOuter = schema.$id?.includes('section.schema.json') ? schema : outerSchema;

        let fieldConfig;
        if (arraySchema.$ref) {
          const resolvedSchema = getSchema(getLayeredRefId(ajv, arraySchema.$ref as string, componentSchemaId));
          fieldConfig = buildConfig(resolvedSchema, schemaOuter, resolvedSchema.$id || componentSchemaId);
        } else {
          fieldConfig = buildConfig(arraySchema, schemaOuter, arraySchema.$id || componentSchemaId);
        }

        const field: ArrayField = {
          name,
          type: 'array',
          title,
          description: buildDescription(outerSchema),
          of: [],
        };

        // TODO this needs to be refined (probably add explicitly in Sanity schema layering)
        // if (outerSchema.default)
        //   field.initialValue = schema.default as string;

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
      const options: { title: string, value: string }[] = schema.enum.map((value) => {
        return {
          title: value as string,
          value: safeEnumKey(value as string),
        };
      });

      const field: StringField = {
        name,
        type: 'string',
        title,
        description: buildDescription(schema),
        options: {
          list: options
        },
      };

      if (schema.const) {
        field.initialValue = schema.const;
        field.hidden = true;
        field.readOnly = true;
      }

      // TODO this needs to be refined (probably add explicitly in Sanity schema layering)
      // if (schema.default)
      //   field.initialValue = safeEnumKey(schema.default as string);

      // TODO this is a function in Sanity, needs to be added:
      // e.g. https://www.sanity.io/docs/string-type#required()-f5fd99d2b4c6
      // field.required = schema.required?.includes(name) || false;

      return field;
    }

    // ref?
    else if (!_.isUndefined(schema.$ref)) {
      const reffedPropertyName = schema.$ref.includes('http')
        ? schema.$ref.split('#').pop()?.split('/').pop()
        : schema.$ref.split('/').pop();

      if (schema.$ref.includes('#/definitions/')) {
        const reffedSchemaId = schema.$ref.includes('http') ? schema.$ref.split('#').shift() : outerSchema.$id;

        const reffedSchema = getSchema(getLayeredRefId(ajv, reffedSchemaId as string, componentSchemaId));
        const reffedProperty = jsonPointer.has(reffedSchema, schema.$ref.split('#').pop() as string)
          ? jsonPointer.get(reffedSchema, schema.$ref.split('#').pop() as string)
          : allDefinitions[reffedPropertyName as string] as JSONSchema7;

        const [, hashPath] = schema.$ref.split('#/definitions/');
        const trail = hashPath ? hashPath.split('/properties/').filter(Boolean) : [];
        trail.pop()

        return buildConfig(reffedProperty, schema.$id?.includes('section.schema.json') ? schema : outerSchema, reffedProperty.$id || componentSchemaId, propPath.concat(trail));
      } else {
        const [, hashPath] = schema.$ref.split('#');
        const trail = expandPropPath
          ? hashPath ? hashPath.split('/properties/').filter(Boolean) : [getSchemaName(schema.$ref)]
          : [];

        const reffedSchema = getSchema(getLayeredRefId(ajv, schema.$ref, componentSchemaId))
        return buildConfig(reffedSchema, schema.$id?.includes('section.schema.json') ? schema : outerSchema, reffedSchema.$id || componentSchemaId, propPath.concat(trail));
      }
    }

    // basic?
    else if (widgetMapping(schema, name, title)) {
      const field = widgetMapping(schema, name, title);
      field.description = buildDescription(schema)

      // TODO re-check this
      // if (widget === 'number')
      //   field.valueType = 'int';

      // TODO this needs to be refined (probably add explicitly in Sanity schema layering)
      // if (schema.default)
      //   field.initialValue = schema.default as string;

      // TODO this is a function in Sanity, needs to be added:
      // e.g. https://www.sanity.io/docs/string-type#required()-f5fd99d2b4c6
      // field.required = outerSchema.required?.includes(name) || false;

      return field;
    }

    // ¯\_(ツ)_/¯
    else throw err(`The type ${schema.type} on property ${name} is unknown.`);
  }

  return schemas.map((schema: SanityJSONSchema) => {
    const name = getSchemaName(schema.$id);
    const title = toPascalCase(name);
    const fieldItems = (schema.properties.fields?.items as JSONSchema7[]) || [];
    schema.properties.fields.minItems = schema.properties.fields.maxItems = fieldItems.length;

    return {
      name,
      title,
      type: 'object',
      fields: fieldItems.map((fieldSchema) =>
        buildConfig(fieldSchema, schema, fieldSchema.$id || schema.$id)
      ),
      preview: schema.properties.preview?.const,
    } as Field<string>;
  })
}

function buildDescription(d: any): string | undefined {
  return d.description || d.title || undefined;
}
