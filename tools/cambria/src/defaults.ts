import pkg from 'fast-json-patch';
import { JSONSchema, TypeName } from 'json-schema-typed/draft-07';

import { Patch } from './patch.js';

const { applyPatch } = pkg;

/**
 * behaviour:
 *  - if we have an array of types where null is an option, that's our default
 *  - otherwise use the first type in the array to pick a default from the table
 *  - otherwise just use the value to lookup in the table
 */
const defaultValuesForType: {
  [TypeName.String]: string;
  [TypeName.Number]: number;
  [TypeName.Integer]: number;
  [TypeName.Boolean]: boolean;
  [TypeName.Array]: object;
  [TypeName.Object]: object;
  [TypeName.Null]: null;
} = {
  [TypeName.String]: '',
  [TypeName.Number]: 0,
  [TypeName.Integer]: 0,
  [TypeName.Boolean]: false,
  [TypeName.Array]: [],
  [TypeName.Object]: {},
  [TypeName.Null]: null
};

export function defaultValuesByType(type: JSONSchema.TypeValue): JSONSchema.Interface['default'] {
  if (Array.isArray(type)) {
    if (type.includes(TypeName.Null)) {
      return null;
    }
    return defaultValuesForType[type[0] as TypeName];
  }
  return defaultValuesForType[type as TypeName];
}

// export function defaultValuesByType(type: TypeName | TypeName[]): JSONSchema.Interface['default'] {
//   if (Array.isArray(type)) {
//     if (type.includes(TypeName.Null)) {
//       return null;
//     }
//     return defaultValuesForType[type[0]];
//   }
//   return defaultValuesForType[type];
// }

// Return a recursively filled-in default object for a given schema
export function defaultObjectForSchema(schema: JSONSchema.Object): JSONSchema.Object {
  // By setting the root to empty object,
  // we kick off a recursive process that fills in the entire thing
  const initializeRootPatch = [
    {
      op: 'add' as const,
      path: '',
      value: {}
    }
  ];
  const defaultsPatch = addDefaultValues(initializeRootPatch, schema);

  return applyPatch({}, defaultsPatch).newDocument;
}

export function addDefaultValues(patch: Patch, schema: JSONSchema.Interface): Patch {
  return patch
    .map((op) => {
      const isMakeMap =
        (op.op === 'add' || op.op === 'replace') &&
        op.value !== null &&
        typeof op.value === 'object' &&
        Object.entries(op.value).length === 0;

      if (!isMakeMap) return op;

      const objectProperties = getPropertiesForPath(schema, op.path);

      return [
        op,
        // fill in default values for each property on the object
        ...Object.entries(objectProperties).map(([propName, propSchema]) => {
          if (typeof propSchema !== 'object') throw new Error(`Missing property ${propName}`);
          const path = `${op.path}/${propName}`;

          // Fill in a default iff:
          // 1) it's an object or array: init to empty
          // 2) it's another type and there's a default value set.
          // TODO: is this right?
          // Should we allow defaulting containers to non-empty? seems like no.
          // Should we fill in "default defaults" like empty string?
          // I think better to let the json schema explicitly define defaults
          let defaultValue;
          if (propSchema.type === 'object') {
            defaultValue = {};
          } else if (propSchema.type === 'array') {
            defaultValue = [];
          } else if ('default' in propSchema) {
            defaultValue = propSchema.default;
          } else if (Array.isArray(propSchema.type) && propSchema.type.includes('null')) {
            defaultValue = null;
          }

          if (defaultValue !== undefined) {
            // todo: this is a TS hint, see if we can remove
            if (op.op !== 'add' && op.op !== 'replace') throw new Error('');
            return addDefaultValues([{ ...op, path, value: defaultValue }], schema);
          }
          return [];
        })
      ].flat(Infinity);
    })
    .flat(Infinity) as Patch;
}

// given a json schema and a json path to an object field somewhere in that schema,
// return the json schema for the object being pointed to
function getPropertiesForPath(schema: JSONSchema.Interface, path: string): Record<string, JSONSchema> {
  const pathComponents = path.split('/').slice(1);
  const reduced = pathComponents.reduce<JSONSchema.Interface>((schema, pathSegment): JSONSchema.Interface => {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (types.includes('object')) {
      const schemaForProperty = schema.properties && schema.properties[pathSegment];
      if (typeof schemaForProperty !== 'object') throw new Error('Expected object');
      return schemaForProperty;
    }
    if (types.includes('array')) {
      // throw away the array index, just return the schema for array items
      if (!schema.items || typeof schema.items !== 'object')
        throw new Error('Expected array items to have types');

      // todo: revisit this "as", was a huge pain to get this past TS
      return schema.items as JSONSchema.Object;
    }
    throw new Error('Expected object or array in schema based on JSON Pointer');
  }, schema);

  if (typeof reduced === 'boolean' || reduced.properties === undefined) {
    return {};
  }

  return reduced.properties;
}
