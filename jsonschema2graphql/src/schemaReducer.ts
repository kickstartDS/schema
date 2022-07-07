import _ from 'lodash';
import uppercamelcase from 'uppercamelcase';
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLType,
  GraphQLUnionType,
  GraphQLInterfaceType,
} from 'graphql';
import { JSONSchema7 } from 'json-schema';
import { getSchemaName } from '@kickstartds/jsonschema-utils/dist/helpers';
import { GraphQLTypeMap } from './@types';
import { getTypeName } from './getTypeName';
import { graphqlSafeEnumKey } from './graphqlSafeEnumKey';
import { err } from './helpers';

import { cleanFieldName } from './dehashing';

const typeResolutionField = 'type';

/** Maps basic JSON schema types to basic GraphQL types */
const BASIC_TYPE_MAPPING = {
  string: GraphQLString,
  integer: GraphQLInt,
  number: GraphQLFloat,
  boolean: GraphQLBoolean,
};

const gatsbyFileInterface = new GraphQLInterfaceType({
  name: 'File',
  fields: {}
});

// TODO check for fields generated without comment / documentation
export function getSchemaReducer(
  schemaPost: (schema: JSONSchema7) => JSONSchema7,
  componentInterfaces: Record<string, string[]>,
  gatsbyImages = true,
) {
  const interfaceTypes: Record<string, GraphQLInterfaceType> = {};

  function schemaReducer(knownTypes: GraphQLTypeMap, schema: JSONSchema7): GraphQLTypeMap {
    const $id = schema.$id
    if (_.isUndefined($id)) throw err('Schema does not have an `$id` property.');

    const typeName = getTypeName($id);
    const clonedSchema = schemaPost
      ? schemaPost(_.cloneDeep(schema))
      : _.cloneDeep(schema);

    knownTypes[typeName] = buildType(typeName, clonedSchema, knownTypes, true, clonedSchema);
    return knownTypes;
  }

  function getComponentInterface(interfaceName: string) {
    if (!interfaceTypes[interfaceName]) {
      interfaceTypes[interfaceName] = new GraphQLInterfaceType({
        name: interfaceName,
        fields: {
          type: { type: GraphQLString }
        },
      });
    }

    return interfaceTypes[interfaceName];
  }

  function buildType(
    propName: string,
    schema: JSONSchema7,
    knownTypes: GraphQLTypeMap,
    outerRun: boolean = false,
    outerSchema: JSONSchema7,
  ): GraphQLType {
    const sectionComponent = (outerSchema.$id?.includes('section.schema.json'));
    const headerComponent = (outerSchema.$id?.includes('/cms/header.schema.json'));
    const footerComponent = (outerSchema.$id?.includes('/cms/footer.schema.json'));
    const contentComponent = outerRun && !sectionComponent && !headerComponent && !footerComponent;
    const name = uppercamelcase(cleanFieldName(propName));

    // oneOf?
    if (!_.isUndefined(schema.oneOf)) {
      const description = buildDescription(schema);

      const cases = schema.oneOf as JSONSchema7;
      const caseKeys = Object.keys(cases);
      const types: GraphQLObjectType[] = caseKeys.map((caseIndex: string) => {
        const caseSchema = cases[caseIndex];
        const typeSchema = _.cloneDeep(caseSchema.then || caseSchema) as JSONSchema7;
        const qualifiedName = `${name}_${getSchemaName(typeSchema.$ref) || caseIndex}`;

        return buildType(qualifiedName, typeSchema, knownTypes, false, outerSchema) as GraphQLObjectType;
      })

      return new GraphQLUnionType({ name, description, types });
    }

    // anyOf?
    else if (!_.isUndefined(schema.anyOf)) {
      const description = buildDescription(schema);

      const cases = schema.anyOf as JSONSchema7;
      const caseKeys = Object.keys(cases);
      const types: GraphQLObjectType[] = caseKeys.map((caseIndex: string) => {
        const caseSchema = cases[caseIndex];
        const typeSchema = _.cloneDeep(caseSchema.then || caseSchema) as JSONSchema7;
        const qualifiedName = `${name}_${getSchemaName(typeSchema.$ref) || caseIndex}`;

        return buildType(qualifiedName, typeSchema, knownTypes, false, outerSchema) as GraphQLObjectType;
      });

      return new GraphQLUnionType({ name, description, types });
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

      const fields = () =>
        !_.isEmpty(schema.properties)
          ? _.mapValues(schema.properties, (prop: JSONSchema7, fieldName: string) => {
              const qualifiedFieldName = `${name}.${fieldName}`
              const objectSchema = _.cloneDeep(prop);

              const type = buildType(qualifiedFieldName, objectSchema, knownTypes, false, outerSchema) as GraphQLObjectType
              const isRequired = _.includes(schema.required, fieldName)
              return {
                type: isRequired ? new GraphQLNonNull(type) : type,
                description: buildDescription(objectSchema),
              }
            })
          : // GraphQL doesn't allow types with no fields, so put a placeholder
            { _empty: { type: GraphQLString } };

      const interfaces = contentComponent
        && componentInterfaces[outerSchema.$id]
        && componentInterfaces[outerSchema.$id].length > 0
        ? componentInterfaces[outerSchema.$id].map((interfaceName) =>
          getComponentInterface(interfaceName)
        ) : [];

      return new GraphQLObjectType({ name, description, fields, interfaces });
    }

    // array?
    else if (schema.type === 'array') {
      const arraySchema = _.cloneDeep(schema.items) as JSONSchema7;

      if (arraySchema.anyOf) {
        return new GraphQLList(getComponentInterface(name));
      }

      const elementType = buildType(name, arraySchema, knownTypes, false, outerSchema);
      return new GraphQLList(new GraphQLNonNull(elementType));
    }

    // enum?
    else if (!_.isUndefined(schema.enum)) {
      if (schema.type !== 'string') throw err(`Only string enums are supported.`, name);
      const description = buildDescription(schema);
      const graphqlToJsonMap = _.keyBy(schema.enum, graphqlSafeEnumKey);
      const values = _.mapValues(graphqlToJsonMap, (value: string) => ({ value }));
      const enumType = new GraphQLEnumType({ name, description, values });
      return enumType;
    }

    // ref?
    else if (!_.isUndefined(schema.$ref)) {
      const ref = getTypeName(schema.$ref, outerSchema.$id)
      const type = knownTypes[ref];

      if (!type) throw err(`The referenced type ${ref} is unknown.`, name);
      return type;
    }

    // const?
    else if (!_.isUndefined(schema.const)) {
      // TODO add comment to `type` field in generated `.gql`
      if (!name.toLowerCase().endsWith(typeResolutionField)) {
        console.log('schema.const that is not type', schema);
        throw err(`The const keyword, not on property ${typeResolutionField}, is not supported.`);
      }
      return GraphQLString;
    }

    // image source?
    else if (gatsbyImages && (schema.type as string) === 'string' && schema.format === 'image') {
      return gatsbyFileInterface;
    }

    // basic?
    else if (BASIC_TYPE_MAPPING[schema.type as string]) {
      return BASIC_TYPE_MAPPING[schema.type as string];
    }

    // ¯\_(ツ)_/¯
    else throw err(`The type ${schema.type} on property ${name} is unknown.`);
  }

  return schemaReducer;
}

function buildDescription(d: any): string | undefined {
  if (d.title && d.description) return `${d.title}: ${d.description}`;
  return d.title || d.description || undefined;
}
