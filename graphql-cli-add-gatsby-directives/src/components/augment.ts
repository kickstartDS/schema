import {
  GraphQLObjectType,
  GraphQLNamedType,
  GraphQLFieldMap,
  GraphQLField,
  ListTypeNode,
  NonNullTypeNode,
  NamedTypeNode,
  GraphQLUnionType,
  GraphQLInterfaceType,
  print,
  isSpecifiedScalarType,
  isSpecifiedDirective,
} from "graphql";
import { GraphQLSchema, InterfaceImplementations } from "graphql/type/schema";

const printSchemaWithDirectives = (schema: GraphQLSchema) => {
  const str = Object
    .keys(schema.getTypeMap())
    .filter(k => !k.match(/^__/))
    .reduce((accum, name) => {
      const type = schema.getType(name);
      return name === 'File'
        ? accum += `FILE ${print(type.astNode)}\n`
        : accum += `${print(type.astNode)}\n`;
    }, '');

  return schema
    .getDirectives()
    .reduce((accum, d) => {
      return !isSpecifiedDirective(d)
        ? accum += `${print(d.astNode)}\n`
        : accum;
    }, str + `${print(schema.astNode)}\n`);
};

export const augment = (schema: GraphQLSchema) => {
 return printSchemaWithDirectives(schema);
};