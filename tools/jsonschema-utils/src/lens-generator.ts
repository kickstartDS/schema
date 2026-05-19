import {
  hoistProperty,
  inside,
  LensOp,
  LensSource,
  map,
  removeProperty,
  renameProperty
} from '@kickstartds/cambria';
import { type JSONSchema, TypeName } from 'json-schema-typed/draft-07';

const INLINE_KEYWORD: 'x-cms-group-inline' = 'x-cms-group-inline';
const INLINE_SEPARATOR: string = '__';

function isInlineWrapper(prop: JSONSchema.Interface): boolean {
  return (prop as Record<string, unknown>)[INLINE_KEYWORD] === true;
}

function objectProperties(prop: JSONSchema.Interface): Record<string, JSONSchema.Interface> | undefined {
  if (prop.type !== 'object') return undefined;
  return prop.properties as Record<string, JSONSchema.Interface> | undefined;
}

function arrayItems(prop: JSONSchema.Interface): JSONSchema.Interface | undefined {
  if (prop.type !== 'array') return undefined;
  if (Array.isArray(prop.items)) return undefined;
  return prop.items as JSONSchema.Interface | undefined;
}

/**
 * Generate a Cambria lens that transforms data authored against the un-annotated
 * base schema into the CMS-shaped form produced by the converter.
 *
 * Currently handles `x-cms-group-inline`: the wrapper object's children are
 * hoisted into the parent and renamed `<wrapper>__<child>`. All other
 * annotations (`x-cms-group-name`, `x-cms-order`, ...) are editor-view only
 * and produce identity ops.
 *
 * The returned lens is the **forward** direction (un-annotated -> CMS shape).
 * Consumers reverse it via `reverseLens()` from `@kickstartds/cambria` to
 * recover the original shape from CMS payloads at runtime.
 */
export function generateLens(schema: JSONSchema.Interface): LensSource {
  const ops: LensOp[] = [];
  const properties = objectProperties(schema);
  if (!properties) return ops;

  for (const [name, prop] of Object.entries(properties)) {
    if (!prop || typeof prop !== 'object') continue;

    if (isInlineWrapper(prop)) {
      const childProps = objectProperties(prop);
      if (!childProps) continue;
      const childNames = Object.keys(childProps);

      // Detect collisions with existing siblings before emitting ops.
      for (const childName of childNames) {
        const renamed = `${name}${INLINE_SEPARATOR}${childName}`;
        if (renamed in properties && renamed !== name) {
          throw new Error(
            `Inline child '${childName}' of '${name}' collides with existing sibling '${renamed}'`
          );
        }
      }

      for (const childName of childNames) {
        ops.push(hoistProperty(name, childName));
        ops.push(renameProperty(childName, `${name}${INLINE_SEPARATOR}${childName}`));

        // Recurse into the hoisted child if it is itself an object.
        const child = childProps[childName];
        const subLens = generateLens(child);
        if (subLens.length > 0) {
          ops.push(inside(`${name}${INLINE_SEPARATOR}${childName}`, subLens));
        }
      }

      // Drop the now-empty wrapper.
      ops.push(removeProperty({ name, type: TypeName.Object }));
      continue;
    }

    // Non-inline: recurse into nested objects scoped by `in`.
    const nestedProps = objectProperties(prop);
    if (nestedProps) {
      const subLens = generateLens(prop);
      if (subLens.length > 0) ops.push(inside(name, subLens));
      continue;
    }

    // Arrays of objects: recurse via `map` inside `in`.
    const items = arrayItems(prop);
    if (items && items.type === 'object') {
      const subLens = generateLens(items);
      if (subLens.length > 0) ops.push(inside(name, [map(subLens)]));
    }
  }

  return ops;
}
