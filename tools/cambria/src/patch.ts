/* eslint-disable @rushstack/no-new-null */
import { Operation } from 'fast-json-patch';
import { type JSONSchema } from 'json-schema-typed/draft-07';

import { addDefaultValues } from './defaults.js';
import { updateSchema } from './json-schema.js';
import { LensSource, LensOp } from './lens-ops.js';
import { reverseLens } from './reverse.js';

// todo: we're throwing away the type param right now so it doesn't actually do anything.
// can we actually find a way to keep it around and typecheck patches against a type?
export type PatchOp = Operation;
type MaybePatchOp = PatchOp | null;
export type Patch = Operation[];
export type CompiledLens = (patch: Patch, targetDoc: JSONSchema.Object) => Patch;

function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${x}`);
}

function noNulls<T>(items: (T | null)[]): T[] {
  return items.filter((x): x is T => x !== null);
}

// Provide curried functions that incorporate the lenses internally;
// this is useful for exposing a pre-baked converter function to developers
// without them needing to access the lens themselves
// TODO: the public interface could just be runLens and reverseLens
// ... maybe also composeLens?
export function compile(lensSource: LensSource): { right: CompiledLens; left: CompiledLens } {
  return {
    right: (patch: Patch, targetDoc: JSONSchema.Interface) => applyLensToPatch(lensSource, patch, targetDoc),
    left: (patch: Patch, targetDoc: JSONSchema.Interface) =>
      applyLensToPatch(reverseLens(lensSource), patch, targetDoc)
  };
}

// given a patch, returns a new patch that has had the lens applied to it.
export function applyLensToPatch(
  lensSource: LensSource,
  patch: Patch,
  patchSchema: JSONSchema.Interface // the json schema for the doc the patch was operating on
): Patch {
  // expand patches that set nested objects into scalar patches
  const expandedPatch: Patch = patch.map((op) => expandPatch(op)).flat();

  // send everything through the lens
  const lensedPatch = noNulls<PatchOp>(
    expandedPatch.map((patchOp) => applyLensToPatchOp(lensSource, patchOp))
  );

  // add in default values needed (based on the new schema after lensing)
  const readerSchema = updateSchema(patchSchema, lensSource);
  const lensedPatchWithDefaults = addDefaultValues(lensedPatch, readerSchema);

  return lensedPatchWithDefaults;
}

// todo: remove destinationDoc entirely
export function applyLensToPatchOp(lensSource: LensSource, patchOp: MaybePatchOp): MaybePatchOp {
  return lensSource.reduce<MaybePatchOp>((prevPatch: MaybePatchOp, lensOp: LensOp) => {
    return runLensOp(lensOp, prevPatch);
  }, patchOp);
}

/** A JSON Pointer's segments, escaped: `/a/b` gives `['a', 'b']`, the document root (`''`) none. */
function segmentsOf(path: string): string[] {
  return path === '' ? [] : path.split('/').slice(1);
}

/** The JSON Pointer for escaped segments. */
function pathOf(segments: string[]): string {
  return segments.map((s) => `/${s}`).join('');
}

/** A property name as a JSON Pointer segment (RFC 6901). */
function segment(name: string): string {
  return name.replace(/~/g, '~0').replace(/\//g, '~1');
}

function runLensOp(lensOp: LensOp, patchOp: MaybePatchOp): MaybePatchOp {
  if (patchOp === null) {
    return null;
  }

  switch (lensOp.op) {
    case 'rename': {
      // every op that writes, removes or tests the property, not only add and replace
      const [first, ...rest] = segmentsOf(patchOp.path);
      if (first === segment(lensOp.source)) {
        return { ...patchOp, path: pathOf([segment(lensOp.destination), ...rest]) };
      }
      break;
    }

    case 'hoist': {
      const [possibleSource, possibleDestination, ...rest] = segmentsOf(patchOp.path);
      if (possibleSource === segment(lensOp.host) && possibleDestination === segment(lensOp.name)) {
        return { ...patchOp, path: pathOf([segment(lensOp.name), ...rest]) };
      }
      break;
    }

    case 'plunge': {
      const segments = segmentsOf(patchOp.path);
      if (segments[0] === segment(lensOp.name)) {
        return { ...patchOp, path: pathOf([segment(lensOp.host), ...segments]) };
      }
      break;
    }

    case 'wrap': {
      const [first, ...rest] = segmentsOf(patchOp.path);
      if (first === segment(lensOp.name)) {
        const path = pathOf([first, '0', ...rest]);
        if (
          (patchOp.op === 'add' || patchOp.op === 'replace') &&
          patchOp.value === null &&
          rest.length === 0
        ) {
          return { op: 'remove', path };
        }
        return { ...patchOp, path };
      }
      break;
    }

    case 'head': {
      // break early if we're not handling a write to the array handled by this lens
      const [first, index, ...rest] = segmentsOf(patchOp.path);
      if (first !== segment(lensOp.name)) break;

      // We only care about writes to the head element, nothing else matters
      if (index !== '0') return null;
      const path = pathOf([first, ...rest]);

      if (patchOp.op === 'add' || patchOp.op === 'replace') {
        // If the write is to the first array element, write to the scalar
        return { op: patchOp.op, path, value: patchOp.value };
      }

      if (patchOp.op === 'remove') {
        return rest.length === 0 ? { op: 'replace' as const, path, value: null } : { ...patchOp, path };
      }

      break;
    }

    case 'add':
      // hmm, what do we do here? perhaps write the default value if there's nothing
      // already written into the doc there?
      // (could be a good use case for destinationDoc)
      break;

    case 'remove':
      if (lensOp.name !== undefined && segmentsOf(patchOp.path)[0] === segment(lensOp.name)) return null;
      break;

    case 'in': {
      // Run the inner body in a context where the path has been narrowed down...
      const [first, ...rest] = segmentsOf(patchOp.path);
      if (first === segment(lensOp.name)) {
        const childPatch = applyLensToPatchOp(lensOp.lens, { ...patchOp, path: pathOf(rest) });

        if (childPatch) {
          return { ...childPatch, path: `${pathOf([first])}${childPatch.path}` };
        } else {
          return null;
        }
      }
      break;
    }

    case 'map': {
      const arrayIndexMatch = patchOp.path.match(/\/([0-9]+)\//);
      if (!arrayIndexMatch) break;
      const arrayIndex = arrayIndexMatch[1];
      const itemPatch = applyLensToPatchOp(
        lensOp.lens,
        { ...patchOp, path: patchOp.path.replace(/\/[0-9]+\//, '/') }
        // Then add the parent path back to the beginning of the results
      );

      if (itemPatch) {
        return { ...itemPatch, path: `/${arrayIndex}${itemPatch.path}` };
      }
      return null;
    }

    case 'convert': {
      if (patchOp.op !== 'add' && patchOp.op !== 'replace') break;
      if (`/${lensOp.name}` !== patchOp.path) break;
      const stringifiedValue = String(patchOp.value);

      // todo: should we add in support for fallback/default conversions
      if (!Object.keys(lensOp.mapping[0]).includes(stringifiedValue)) {
        throw new Error(`No mapping for value: ${stringifiedValue}`);
      }

      return { ...patchOp, value: lensOp.mapping[0][stringifiedValue] };
    }

    default:
      assertNever(lensOp); // exhaustiveness check
  }

  return patchOp;
}

interface INestedPatchOpArray extends Array<INestedPatchOpArray | PatchOp> {}

export function expandPatch(patchOp: PatchOp): PatchOp[] {
  // this only applies for add and replace ops; no expansion to do otherwise
  // todo: check the whole list of json patch verbs
  if (patchOp.op !== 'add' && patchOp.op !== 'replace') return [patchOp];

  if (patchOp.value && typeof patchOp.value === 'object') {
    let result: INestedPatchOpArray = [
      {
        op: patchOp.op,
        path: patchOp.path,
        value: Array.isArray(patchOp.value) ? [] : {}
      }
    ];

    result = result.concat(
      Object.entries(patchOp.value)
        .map(([key, value]) => {
          return expandPatch({
            op: patchOp.op,
            path: `${patchOp.path}/${key}`,
            value
          });
        })
        .flat(2)
    );

    return result.flat(2) as PatchOp[];
  }
  return [patchOp];
}
