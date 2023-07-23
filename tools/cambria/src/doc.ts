/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import pkg from 'fast-json-patch';
import { JSONSchema } from 'json-schema-typed/draft-07';
import toJSONSchema, { Options } from 'to-json-schema';

import { defaultObjectForSchema } from './defaults.js';
import { updateSchema } from './json-schema.js';
import { LensSource } from './lens-ops.js';
import { Patch, applyLensToPatch } from './patch.js';

const { compare, applyPatch } = pkg;

/**
 * importDoc - convert any Plain Old Javascript Object into an implied JSON Schema and
 *             a JSON Patch that sets every value in that document.
 * @param inputDoc a document to convert into a big JSON patch describing its full contents
 */
export function importDoc(inputDoc: { [key: string]: unknown }): [JSONSchema.Object, Patch] {
  const options: Options = {
    postProcessFnc: (type, schema, obj, defaultFnc) => ({
      ...defaultFnc(type, schema, obj),
      type: [type, 'null']
    }),
    objects: {
      postProcessFnc: (schema, obj, defaultFnc) => ({
        ...defaultFnc(schema, obj),
        required: Object.getOwnPropertyNames(obj)
      })
    }
  };

  const schema = toJSONSchema(inputDoc, options) as JSONSchema.Object;
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
  const [impliedSchema, patchForOriginalDoc] = importDoc(inputDoc);

  if (inputSchema === undefined || inputSchema === null) {
    inputSchema = impliedSchema;
  }

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
