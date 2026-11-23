import fastJsonPatch from 'fast-json-patch';

import { applyLensToDoc } from './doc.js';
import { updateSchema } from './json-schema.js';
import { LensSource } from './lens-ops.js';
import { applyLensToPatch, applyLensToPatchOp } from './patch.js';
import { reverseLens } from './reverse.js';

const { compare, applyPatch } = fastJsonPatch;

// Lens ops match a patch's path segment by segment: a property whose name starts with another
// one's is a different property.
describe('patch paths', () => {
  const convert = (lens: LensSource, path: string): string | undefined =>
    applyLensToPatchOp(lens, { op: 'replace', path, value: 1 })?.path;

  it('plunges a nested path below the host', () => {
    expect(convert([{ op: 'plunge', host: 'meta', name: 'geo' }], '/geo/lat')).toBe('/meta/geo/lat');
  });

  it('leaves a property alone whose name starts with the wrapped one', () => {
    expect(convert([{ op: 'wrap', name: 'tag' }], '/tags')).toBe('/tags');
  });

  it('leaves a property alone whose name starts with the one looked into', () => {
    const lens: LensSource = [
      { op: 'in', name: 'addr', lens: [{ op: 'rename', source: 'a', destination: 'b' }] }
    ];
    expect(convert(lens, '/address/a')).toBe('/address/a');
    expect(convert(lens, '/addr/a')).toBe('/addr/b');
  });

  it('plunges and wraps a property whose name needs escaping', () => {
    expect(convert([{ op: 'plunge', host: 'a/b', name: 'c' }], '/c')).toBe('/a~1b/c');
    expect(convert([{ op: 'wrap', name: 'x~y' }], '/x~0y')).toBe('/x~0y/0');
  });

  it('renames the property of a remove op', () => {
    const lens: LensSource = [{ op: 'rename', source: 'firstName', destination: 'givenName' }];
    expect(applyLensToPatchOp(reverseLens(lens), { op: 'remove', path: '/givenName' })).toEqual({
      op: 'remove',
      path: '/firstName'
    });
  });
});

// `head` makes a nullable schema as anyOf; its reverse, `wrap`, reads it.
describe('a head lens, reversed against the schema it made', () => {
  const lens: LensSource = [{ op: 'head', name: 'phones' }];
  const apiSchema = {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const },
      phones: { type: 'array' as const, items: { type: 'string' as const } }
    }
  };
  const headSchema = updateSchema(apiSchema, lens);
  const original = { name: 'Emily', phones: ['+1 111', '+1 222'] };
  const before = applyLensToDoc(lens, original, apiSchema);
  const save = (after: object): object =>
    applyPatch(
      structuredClone(original),
      applyLensToPatch(reverseLens(lens), compare(before, after), headSchema)
    ).newDocument;

  it('wraps the head schema back into an array', () => {
    expect(updateSchema(headSchema, reverseLens(lens)).properties?.phones).toMatchObject({
      type: 'array',
      items: { type: 'string' }
    });
  });

  it('converts an edit of another property without touching the array', () => {
    expect(save({ ...before, name: 'Emma' })).toEqual({ name: 'Emma', phones: ['+1 111', '+1 222'] });
  });

  it('converts an edit of the head into an edit of the first item', () => {
    expect(save({ ...before, phones: '+1 999' })).toEqual({ name: 'Emily', phones: ['+1 999', '+1 222'] });
  });
});
