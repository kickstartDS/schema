import {
  GraphQLObjectType,
  GraphQLNamedType,
  GraphQLFieldMap,
  GraphQLField,
  ListTypeNode,
  NonNullTypeNode,
  NamedTypeNode
} from "graphql";
import { GraphQLSchema } from "graphql/type/schema";

export const generate = (schema: GraphQLSchema) => {
  const indentedLine = (level: number) => {
    let line = "\n";
    for (let i = 0; i < level; i++) {
      line += "  ";
    }
    return line;
  }

  const fragmentTypes = {
    DEFAULT: "",
    NO_RELATIONS: "NoNesting",
    DEEP: "DeepNesting"
  };

  const makeFragments = (schema: GraphQLSchema, generator: string) => {
    const ast: GraphQLSchema = schema;

    const typeNames = Object.keys(ast.getTypeMap())
      .filter(
        typeName =>
          ast.getType(typeName) !== undefined
      )
      .filter(
        typeName =>
          (ast.getType(typeName) as GraphQLNamedType).constructor.name === "GraphQLObjectType"
      )
      .filter(typeName => !typeName.startsWith("__"))
      .filter(typeName => typeName !== (ast.getQueryType() as GraphQLObjectType).name)
      .filter(
        typeName =>
          ast.getMutationType()
            ? typeName !== (ast.getMutationType() as GraphQLObjectType)!.name
            : true
      )
      .filter(
        typeName =>
          ast.getSubscriptionType()
            ? typeName !== (ast.getSubscriptionType() as GraphQLObjectType)!.name
            : true
      )
      .sort(
        (a, b) =>
          (ast.getType(a) as GraphQLNamedType).constructor.name < (ast.getType(b) as GraphQLNamedType).constructor.name
            ? -1
            : 1
      );

    const standardFragments = typeNames.map(typeName => {
      const type: any = ast.getType(typeName);
      const { name } = type;

      const fields = generateFragments(type, ast);
      if(fields.length === 0) return null
      return {
        name,
        fragment: `fragment ${name} on ${name} {
  ${fields.join(indentedLine(1))}
}
`
      };
    }).filter(frag => frag != null);

    const noRelationsFragments = typeNames.map(typeName => {
      const type: any = ast.getType(typeName);
      const { name } = type;

      const fields = generateFragments(type, ast, fragmentTypes.NO_RELATIONS);
      if(fields.length === 0) return null
      
      return {
        name,
        fragment: `fragment ${name}${
          fragmentTypes.NO_RELATIONS
        } on ${name} {
  ${fields.join(indentedLine(1))}
}
`
      };
    }).filter(frag => frag != null);
    const deepFragments = typeNames.map(typeName => {
      const type: any = ast.getType(typeName);
      const { name } = type;

      const fields = generateFragments(type, ast, fragmentTypes.DEEP);
        if(fields.length === 0) return null
      return {
        name,
        fragment: `fragment ${name}${fragmentTypes.DEEP} on ${name} {
  ${fields.join(indentedLine(1))}
}
`
      };
    }).filter(frag => frag != null);

    if (generator === "js") {
      return `// THIS FILE HAS BEEN AUTO-GENERATED BY "graphql-cli-generate-fragments"
// DO NOT EDIT THIS FILE DIRECTLY
${standardFragments
        .map(
          ({ name, fragment }) => `
export const ${name}Fragment = \`${fragment}\`
`
        )
        .join("")}
${noRelationsFragments
        .map(
          ({ name, fragment }) => `
export const ${name}${fragmentTypes.NO_RELATIONS}Fragment = \`${fragment}\`
`
        )
        .join("")}
${deepFragments
        .map(
          ({ name, fragment }) => `
export const ${name}${fragmentTypes.DEEP}Fragment = \`${fragment}\`
`
        )
        .join("")}
`;
    }
    return `# THIS FILE HAS BEEN AUTO-GENERATED BY "graphql-cli-generate-fragments"
# DO NOT EDIT THIS FILE DIRECTLY

# Standard Fragments
# Nested fragments will spread one layer deep

${standardFragments
      .map(
        ({ name, fragment }) => `
${fragment}`
      )
      .join("")}

# No Relational objects
# No nested fragments

${noRelationsFragments
      .map(
        ({ name, fragment }) => `
${fragment}`
      )
      .join("")}

# Deeply nested Fragments
# Will include n nested fragments
# If there is a recursive relation you will receive a
# "Cannot spread fragment within itself" error when using

${deepFragments
      .map(
        ({ name, fragment }) => `
${fragment}`
      )
      .join("")}
`;
  }

  const generateFragments = (type: any, ast: GraphQLSchema, fragmentType = fragmentTypes.DEFAULT) => {
    const fields: GraphQLFieldMap<any, any> = type.getFields();
    const fragmentFields = Object.keys(fields)
      .map(field => {
        return printField(field, fields[field], ast, fragmentType);
      })
      // Some fields should not be printed, ie. fields with relations.
      // Remove those from the output by returning null from printField.
      .filter(field => field != null);
    return fragmentFields;
  }

  const printField = (
    fieldName: string,
    field: GraphQLField<any, any> | null,
    ast: GraphQLSchema,
    fragmentType: string,
    indent = 1
  ): any => {
    // TODO this should *NOT* be of type `any`
    let internalField: any;
    let constructorName =
      field.type.constructor.name && field.type.constructor.name;

    // TODO not sure what this one is about... thus no idea on how to fix the types
    /*if (constructorName === "Object")
      constructorName =
        ((field.type).name &&
          (ast.getType(field.type.name.value) as GraphQLNamedType).constructor.name) ||
        null;*/
    
    if (constructorName === "GraphQLList") {
      internalField =
        ((field.astNode.type as ListTypeNode).type as NonNullTypeNode).type && (((field.astNode.type as ListTypeNode).type as NonNullTypeNode).type as NamedTypeNode) ||
        ((field.astNode.type as ListTypeNode).type && ((field.astNode.type as ListTypeNode).type as NonNullTypeNode) || null);

      if (internalField === null) {
        throw new Error(`Schema malformed - list`);
      }
      constructorName = (ast.getType(internalField.name.value) as GraphQLNamedType).constructor.name;
    }

    // TODO field.kind === "NonNullType" seems to not exist for our usecase
    //if (constructorName === "GraphQLNonNull" || field.kind === "NonNullType") {
    if (constructorName === "GraphQLNonNull") {
      internalField = (field.astNode.type && field.astNode.type);
      constructorName =
      (internalField.type.name &&
        (ast.getType(internalField.type.name.value) as GraphQLNamedType).constructor.name) ||
      null;
      if (constructorName === null) {
        // TODO there are still components / fragments landing here (only lists / arrays for Slides-variants)
        // those are not correctly handled, as they stay "null" after this
        // other than that, this snippet doesn't seem to do anything (for us at least)
        internalField = (internalField.type && internalField.type) || null;
        constructorName =
          (internalField.type.name &&
            (ast.getType(internalField.type.name.value) as GraphQLNamedType).constructor.name) ||
          null;
      }
    }

    if (
      constructorName === "GraphQLScalarType" ||
      constructorName === "GraphQLEnumType"
    ) {
      return fieldName;
    }

    if (constructorName === "GraphQLObjectType") {
      if (fragmentType === fragmentTypes.NO_RELATIONS) return null;
      let typeName = internalField
        ? internalField.name && internalField.name.value
        : (field.astNode.type as NamedTypeNode).name.value;

      return (
        fieldName +
        " {" +
        indentedLine(indent + 1) +
        "..." +
        `${(fragmentType === fragmentTypes.DEEP &&
          typeName + fragmentTypes.DEEP) ||
          (fragmentType === fragmentTypes.DEFAULT &&
          typeName + fragmentTypes.NO_RELATIONS) ||
          typeName + fragmentTypes.DEFAULT}` +
        indentedLine(indent) +
        "}"
      );
    }

    // TODO seems to be missing handling for `GraphQLUnionType`
    // TODO doesn't handle some list / array cases (especially Slider variants of components) correctly, see `GraphQLNonNull` branch above

    return null;
  }

  return makeFragments(schema, 'graphql');
};