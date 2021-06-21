import { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import _ from 'lodash';
import { err } from './helpers';
import { NetlifyCmsField } from './@types';
import { safeEnumKey } from './safeEnumKey';
import Ajv from 'ajv';

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

  return mapping[property.type as JSONSchema7TypeName];
};

const allDefinitions = {};

function toPascalCase(text: string): string {
  return text.replace(/(^\w|-\w)/g, clearAndUpper);
}

function clearAndUpper(text: string): string {
  return text.replace(/-/, " ").toUpperCase();
}

export function getSchemaName(schemaId: string | undefined): string {
  return schemaId && schemaId.split('/').pop()?.split('.').shift() || '';
};

// TODO guess we should use contentFields if we're looping them through all the iterations
// could fetch some already generated config fragments from there (if existent). Could
// improve performance (which is not a problem right now)

// TODO check the following NetlifyCmsField properties for all elements:
// * required
// * hint
export function configGenerator(ajv: Ajv, schemas: JSONSchema7[]): NetlifyCmsField[] {
  function buildConfig(
    propName: string,
    schema: JSONSchema7,
    contentFields: NetlifyCmsField[],
    outerSchema: JSONSchema7,
  ): NetlifyCmsField {
    const name = propName;
  
    // oneOf?
    // TODO we don't have an active case for this, try a best effort implementation
    if (!_.isUndefined(schema.oneOf)) {
      // const description = buildDescription(schema);
  
      // const cases = schema.oneOf as JSONSchema7;
      // const caseKeys = Object.keys(cases);
      // const types: GraphQLObjectType[] = caseKeys.map((caseIndex: string) => {
      //   const caseSchema = cases[caseIndex];
      //   const typeSchema = (caseSchema.then || caseSchema) as JSONSchema7;
      //   const qualifiedName = `${name}_${getSchemaName(typeSchema.$ref) || caseIndex}`;
        
      //   return buildConfig(qualifiedName, typeSchema, knownTypes, dedupeFieldNames, false, outerSchema) as GraphQLObjectType;
      // })
      
      // return new GraphQLUnionType({ name, description, types });
  
      return {
        name: 'test',
        widget: 'list',
      };
    }
  
    // anyOf?
    else if (!_.isUndefined(schema.anyOf)) {
      // const description = buildDescription(schema);
  
      // const cases = schema.anyOf as JSONSchema7;
      // const caseKeys = Object.keys(cases);
      // const types: GraphQLObjectType[] = caseKeys.map((caseIndex: string) => {
      //   const caseSchema = cases[caseIndex];
      //   const typeSchema = (caseSchema.then || caseSchema) as JSONSchema7;
      //   const qualifiedName = `${name}_${getSchemaName(typeSchema.$ref) || caseIndex}`;
       
      //   return buildConfig(qualifiedName, typeSchema, knownTypes, dedupeFieldNames, false, outerSchema) as GraphQLObjectType;
      // });
  
      // return new GraphQLUnionType({ name, description, types });
  
      return {
        name: 'test',
        widget: 'list',
      };
    }
  
    // allOf?
    else if (!_.isUndefined(schema.allOf)) {
      const reduceSchemaAllOf = (allOfs: JSONSchema7[]): JSONSchema7 => {
        return allOfs.reduce((finalSchema: JSONSchema7, allOf: JSONSchema7) => {
          const mergeSchemaAllOf = (allOf: JSONSchema7): JSONSchema7 => {
            if (!_.isUndefined(allOf.$ref)) {
              if (allOf.$ref.includes('#/definitions/')) {
                const definitionName = allOf.$ref.split('/').pop() || '';
                const definition = _.cloneDeep(allDefinitions[definitionName]);
                if (definition.allOf) {
                  return _.merge(finalSchema, reduceSchemaAllOf(definition.allOf))
                }
                return _.merge(finalSchema, definition);
              } else {
                const reffedSchema = _.cloneDeep(ajv.getSchema(allOf.$ref)?.schema as JSONSchema7);
                if (reffedSchema.allOf) {
                  return _.merge(finalSchema, reduceSchemaAllOf(reffedSchema.allOf as JSONSchema7[]))
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
  
      const objectSchema = reduceSchemaAllOf(schema.allOf as JSONSchema7[]);
  
      // if (contentComponent && objectSchema && objectSchema.properties)
      //   objectSchema.properties.internalType = internalTypeDefinition;
  
      return buildConfig(name, objectSchema, contentFields, outerSchema);
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
              return buildConfig(fieldName, objectSchema, contentFields, outerSchema);
            })
          : [];
  
      return {
        label: toPascalCase(name),
        name,
        hint: description || '',
        widget: widgetMapping(schema),
        fields: fields(),
      };
    }
  
    // array?
    else if (schema.type === 'array') {
      const arraySchema = schema.items as JSONSchema7;
      const fieldConfig: NetlifyCmsField = buildConfig(name, arraySchema, contentFields, outerSchema);
      const config: NetlifyCmsField = {
        label: toPascalCase(name),
        name,
        widget: 'list',
      };

      if (fieldConfig && fieldConfig.fields)
        config.fields = fieldConfig.fields;

      return config;
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
  
      return {
        label: toPascalCase(name),
        name,
        widget: 'select',
        default: schema.default as string || '',
        hint: description,
        required: schema.required?.includes(name) || false,
        options,
      };
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

        const reffedSchema = ajv.getSchema(reffedSchemaId as string)?.schema as JSONSchema7;
        const reffedProperty = reffedSchema && reffedSchema.definitions ? reffedSchema.definitions[reffedPropertyName as string] as JSONSchema7 : '' as JSONSchema7

        return buildConfig(reffedPropertyName as string, reffedProperty, contentFields, outerSchema);
      } else {
        const reffedSchema = ajv.getSchema(schema.$ref as string)?.schema as JSONSchema7;
        return buildConfig(name, reffedSchema, contentFields, outerSchema);
      }
    }
  
    // basic?
    else if (mapping[schema.type as string]) {
      const description = buildDescription(schema);
      const widget = mapping[schema.type as string];
  
      const basicField: NetlifyCmsField = {
        label: toPascalCase(name),
        name,
        hint: description,
        widget,
      };
  
      if (widget === 'number')
        basicField.valueType = 'int';
  
      return basicField;
    }
  
    // ¯\_(ツ)_/¯
    else throw err(`The type ${schema.type} on property ${name} is unknown.`);
  }

  const contentFields: NetlifyCmsField[] = [];
  
  schemas.forEach((schema) => {
    const { definitions } = schema;
    for (const definedTypeName in definitions) {
      allDefinitions[definedTypeName] = definitions[definedTypeName] as JSONSchema7;
    }
  });

  schemas.forEach((schema) => {
    const $id = schema.$id
    if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.');
    const typeName = getSchemaName($id);
    contentFields.push(buildConfig(typeName, schema, contentFields, schema));
  });
  
  return contentFields;
}

function buildDescription(d: any): string | undefined {
  return d.description || d.title || undefined;
}
