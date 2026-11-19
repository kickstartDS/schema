/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import pkg from 'fast-json-patch';
import { JSONSchema } from 'json-schema-typed/draft-07';

import { defaultObjectForSchema } from './defaults.js';
import { updateSchema } from './json-schema.js';
import { LensSource } from './lens-ops.js';
import { Patch, applyLensToPatch } from './patch.js';

const { compare, applyPatch } = pkg;

interface IInferredSchema {
  type: string[];
  properties?: { [key: string]: IInferredSchema };
  required?: string[];
  items?: IInferredSchema;
}

const typeOrder: string[] = ['object', 'array', 'string', 'integer', 'number', 'boolean', 'null'];
const sortTypes: (types: string[]) => string[] = (types) =>
  [...new Set(types)].sort((a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b));

/**
 * mergeSchemas - the schema of a value that is either of two inferred schemas, as the items of one
 * array are: the union of their types and properties, the properties both require.
 */
function mergeSchemas(a: IInferredSchema | undefined, b: IInferredSchema): IInferredSchema {
  if (!a) return b;
  const merged: IInferredSchema = { type: sortTypes([...a.type, ...b.type]) };
  if (a.properties || b.properties) {
    const properties: { [key: string]: IInferredSchema } = { ...a.properties };
    for (const [key, schema] of Object.entries(b.properties || {})) {
      properties[key] = mergeSchemas(properties[key], schema);
    }
    merged.properties = properties;
    // A value that is not an object (such as null) requires nothing of the objects beside it.
    if (a.properties && b.properties) {
      merged.required = (a.required || []).filter((key) => (b.required || []).includes(key));
    } else {
      merged.required = a.required || b.required;
    }
  }
  if (a.items || b.items) {
    merged.items = a.items && b.items ? mergeSchemas(a.items, b.items) : a.items || b.items;
  }
  return merged;
}

/**
 * inferSchema - the JSON Schema implied by a value. Every value may also be null, as API data
 * often is. The items of an array get one schema that covers all of them, null included: an
 * object in one item and null in the next is an object that may be null, and properties present
 * in some items only are properties that are not required.
 */
export function inferSchema(value: unknown): IInferredSchema {
  if (value === null || value === undefined) return { type: ['null'] };
  if (Array.isArray(value)) {
    const items = value.map(inferSchema).reduce<IInferredSchema | undefined>(mergeSchemas, undefined);
    return items ? { type: ['array', 'null'], items } : { type: ['array', 'null'] };
  }
  if (typeof value === 'object') {
    const properties: { [key: string]: IInferredSchema } = {};
    for (const [key, property] of Object.entries(value as { [key: string]: unknown })) {
      properties[key] = inferSchema(property);
    }
    return { type: ['object', 'null'], properties, required: Object.keys(properties) };
  }
  if (typeof value === 'number') return { type: [Number.isInteger(value) ? 'integer' : 'number', 'null'] };
  return { type: [typeof value, 'null'] };
}

/**
 * importDoc - convert any Plain Old Javascript Object into an implied JSON Schema and
 *             a JSON Patch that sets every value in that document.
 * @param inputDoc a document to convert into a big JSON patch describing its full contents
 */
export function importDoc(inputDoc: { [key: string]: unknown }): [JSONSchema.Object, Patch] {
  const schema = inferSchema(inputDoc) as unknown as JSONSchema.Object;
  const patch = compare({}, inputDoc);

  return [schema, patch];
}

/**
 * applyLensToDoc - converts a full document through a lens.
 * Under the hood, we convert your input doc into a big patch and the apply it to the targetDoc.
 * This allows merging data back and forth with other omitted values.
 * @property lensSource: the lens specification to apply to the document
 * @property inputDoc: the Plain Old Javascript Object to convert
 * @property inputSchema: (default: inferred from inputDoc) a JSON schema defining the input
 * @property targetDoc: (default: {}) a document to apply the contents of this document to as a patch
 */
export function applyLensToDoc(
  lensSource: LensSource,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  inputDoc: { [key: string]: unknown },
  inputSchema?: JSONSchema.Object,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  targetDoc?: { [key: string]: unknown }
): { [key: string]: unknown } {
  // A schema passed in is used as it is: inferring one from the document is only the fallback.
  if (inputSchema === undefined || inputSchema === null) {
    inputSchema = importDoc(inputDoc)[0];
  }
  const patchForOriginalDoc = compare({}, inputDoc);

  // construct the "base" upon which we will apply the patches from doc.
  // We start with the default object for the output schema,
  // then we add in any existing fields on the target doc.
  // TODO: I think we need to deep merge here, can't just shallow merge?
  const outputSchema = updateSchema(inputSchema, lensSource);
  const base = Object.assign(defaultObjectForSchema(outputSchema as JSONSchema.Object), targetDoc || {});

  // return a doc based on the converted patch.
  // (start with either a specified baseDoc, or just empty doc)
  // convert the patch through the lens
  const outputPatch = applyLensToPatch(lensSource, patchForOriginalDoc, inputSchema);
  return applyPatch(base, outputPatch).newDocument;
}
