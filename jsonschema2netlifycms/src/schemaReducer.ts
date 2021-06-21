import { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import _ from 'lodash';
import { err } from './helpers';
import { NetlifyCmsField } from './@types';
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

export function schemaReducer(ajv: Ajv, schema: JSONSchema7): Ajv {
  if (schema.$id && !ajv.getSchema(schema.$id)) {
    ajv.addSchema(schema);
  }
  ajv.validateSchema(schema);

  return ajv;
}

export function configGenerator(ajv: Ajv, schemas: JSONSchema7[]): NetlifyCmsField[] {
  const contentFields: NetlifyCmsField[] = [];
  
  schemas.forEach((schema) => {
    const $id = schema.$id
    if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.');
    const typeName = getSchemaName($id);
  
    const { definitions } = schema;
    for (const definedTypeName in definitions) {
      allDefinitions[definedTypeName] = definitions[definedTypeName] as JSONSchema7;
    }
  
    contentFields.push(buildConfig(typeName, schema, contentFields, true, schema));
  });
  
  
  return contentFields;
}

function buildConfig(
  propName: string,
  schema: JSONSchema7,
  contentFields: Object,
  outerRun: boolean = false,
  outerSchema: JSONSchema7,
): NetlifyCmsField {
  const sectionComponent = (outerSchema.$id?.includes('section.schema.json'));
  const contentComponent = outerRun && !sectionComponent;
  const name = propName;

  // oneOf?
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
  // TODO this adds e.g. `Video`, `Image` and `LightboxImage` instead of
  // `TextMediaComponentMediaVideo`, `TextMediaComponentMediaImage` and
  // `TextMediaComponentMediaLightboxImage` (for TextMediaComponent)
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
    // const reduceSchemaAllOf = (allOfs: JSONSchema7[]): JSONSchema7 => {
    //   return allOfs.reduce((finalSchema: JSONSchema7, allOf: JSONSchema7) => {
    //     const mergeSchemaAllOf = (allOf: JSONSchema7): JSONSchema7 => {
    //       if (!_.isUndefined(allOf.$ref)) {
    //         if (allOf.$ref.includes('#/definitions/')) {
    //           const definitionName = allOf.$ref.split('/').pop() || '';
    //           const definition = _.cloneDeep(allDefinitions[definitionName]);
    //           if (definition.allOf) {
    //             return _.merge(finalSchema, reduceSchemaAllOf(definition.allOf))
    //           }
    //           return _.merge(finalSchema, definition);
    //         } else {
    //           const reffedSchema = _.cloneDeep(ajv.getSchema(allOf.$ref)?.schema as JSONSchema7);
    //           if (reffedSchema.allOf) {
    //             return _.merge(finalSchema, reduceSchemaAllOf(reffedSchema.allOf as JSONSchema7[]))
    //           }
    //           return _.merge(finalSchema, reffedSchema);
    //         }
    //       } else {
    //         return _.merge(finalSchema, allOf);
    //       }
    //     };

    //     return mergeSchemaAllOf(allOf);
    //   }, { } as JSONSchema7);
    // };

    // const objectSchema = reduceSchemaAllOf(schema.allOf as JSONSchema7[]);

    // if (contentComponent && objectSchema && objectSchema.properties)
    //   objectSchema.properties.internalType = internalTypeDefinition;

    // return buildConfig(name, objectSchema, knownTypes, dedupeFieldNames, outerRun, outerSchema) as GraphQLObjectType;

    return {
      name: 'test',
      widget: 'list',
    };
  }

  // not?
  else if (!_.isUndefined(schema.not)) {
    console.log('schema with not', schema);
    throw err(`The type not on property ${name} is not supported.`);
  }

  // object?
  else if (schema.type === 'object') {
    const description = buildDescription(schema);

    // if (contentComponent && schema && schema.properties)
    //   schema.properties.internalType = internalTypeDefinition;

    const fields = (): NetlifyCmsField[] =>
      !_.isEmpty(schema.properties)
        ? _.map(schema.properties, (prop: JSONSchema7, fieldName: string) => {
            const qualifiedFieldName = `${name}.${fieldName}`
            const objectSchema = _.cloneDeep(prop);

            const type = buildConfig(qualifiedFieldName, objectSchema, contentFields, false, outerSchema);
            return type;
          })
        : [];

    // return new GraphQLObjectType({ name, description, fields, interfaces });

    return {
      label: toPascalCase(name),
      name,
      hint: description,
      widget: widgetMapping(schema),
      fields: fields(),
    };
    // return { name, description, fields };
  }

  // array?
  else if (schema.type === 'array') {
    // const arraySchema = schema.items as JSONSchema7;
    // arraySchema.properties = dedupe(arraySchema, getSchemaName(outerSchema.$id));

    // const elementType = buildConfig(name, arraySchema, knownTypes, dedupeFieldNames, false, outerSchema);
    // return name === 'SectionComponentContent'
    //   ? new GraphQLList(new GraphQLNonNull(contentComponentInterface))
    //   : new GraphQLList(new GraphQLNonNull(elementType));

    return {
      name: 'test',
      widget: 'list',
    };
  }

  // enum?
  else if (!_.isUndefined(schema.enum)) {
    // if (schema.type !== 'string') throw err(`Only string enums are supported.`, name);
    // const description = buildDescription(schema);
    // const graphqlToJsonMap = _.keyBy(schema.enum, graphqlSafeEnumKey);
    // const values = _.mapValues(graphqlToJsonMap, (value: string) => ({ value }));
    // const enumType = new GraphQLEnumType({ name, description, values });
    // return enumType;

    return {
      name: 'test',
      widget: 'list',
    };
  }

  // ref?
  else if (!_.isUndefined(schema.$ref)) {
    // const ref = schema.$ref.includes('#/definitions/') && schema.$ref.includes('http')
    //   ? getTypeName(schema.$ref, schema.$ref.split('#').shift())
    //   : getTypeName(schema.$ref, outerSchema.$id);

    // if (schema.$ref.includes('#/definitions/')) {
    //   const ref = schema.$ref.split('#/definitions/').pop() as string;
    //   const definitions = _.cloneDeep(allDefinitions[ref]);

    //   return buildConfig(ref, definitions, knownTypes, shouldDedupe, false, schema);;
    // } else {
    //   const ref = getTypeName(schema.$ref, outerSchema.$id)
    //   const type = knownTypes[ref];

    //   if (!type) throw err(`The referenced type ${ref} is unknown.`, name);
    //   return type;
    // }

    return {
      name: 'test',
      widget: 'list',
    };
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

function buildDescription(d: any): string | undefined {
  // if (d.title && d.description) return `${d.title}: ${d.description}`;
  // return d.title || d.description || undefined;
  return d.description || d.title || undefined;
}
