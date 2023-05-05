// TODO: The exported surface is fairly large right now,
// See how much we can narrow this.

export { updateSchema, schemaForLens } from './json-schema.js'
export { compile, applyLensToPatch, Patch, CompiledLens } from './patch.js'
export { applyLensToDoc, importDoc } from './doc.js'
export { LensSource, LensOp, Property } from './lens-ops.js'
export { defaultObjectForSchema } from './defaults.js'
export { reverseLens } from './reverse.js'
export { LensGraph, initLensGraph, registerLens, lensGraphSchema, lensFromTo } from './lens-graph.js'

export {
  addProperty,
  removeProperty,
  renameProperty,
  hoistProperty,
  plungeProperty,
  wrapProperty,
  headProperty,
  inside,
  map,
  convertValue,
} from './helpers.js'

export { loadYamlLens } from './lens-loader.js'
