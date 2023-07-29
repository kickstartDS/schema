import { mapSchema, MapperKind, printSchemaWithDirectives } from '@graphql-tools/utils';
import { GraphQLSchema } from "graphql/type/schema";

const addFileDirectives = (schema: GraphQLSchema) => {
  const newSchema = mapSchema(schema, {
    [MapperKind.COMPOSITE_FIELD]: (fieldConfig) => {
      if (fieldConfig.type.toString() === 'File') {
        const newFieldConfig = { ...fieldConfig };
        newFieldConfig.extensions = {
          directives: {
            link: { from: `${fieldConfig.astNode.name.value}___NODE` }
          }
        }
        return newFieldConfig;
      }
        
      return fieldConfig;
    },
  });

  return newSchema;
};

export const augment = (schema: GraphQLSchema) =>
  printSchemaWithDirectives(addFileDirectives(schema));