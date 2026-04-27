# PRD: Storyblok Field Grouping (`x-cms-group-*`) & Cambria Inverse Transforms

**Status:** Draft
**Author:** Auto-generated
**Date:** 2026-04-27
**Packages affected:** `@kickstartds/jsonschema2storyblok`, `@kickstartds/jsonschema-utils`, `@kickstartds/cambria` (new generator), `examples/storyblok`

---

## 1. Problem Statement

### 1.1 Storyblok lacks Stackbit's group/inline capabilities

The Stackbit converter consumes four annotations to re-arrange a model's editor surface without changing schema nesting:

| Annotation | Effect (Stackbit) | Code |
|---|---|---|
| `x-cms-group-name` | Tags a field with a logical group | [stackbit/index.ts L154-L218](../tools/jsonschema2stackbit/src/index.ts#L154) |
| `x-cms-group-title` | Sets the group's display label | same |
| `x-cms-group-icon` | Sets the group's icon | same |
| `x-cms-group-inline` | Splices a nested object's fields into the parent, prefixing keys with `<obj>__` | [stackbit/index.ts L88-L116](../tools/jsonschema2stackbit/src/index.ts#L88) |

The Storyblok converter today honors `x-cms-order`, `x-cms-label`, `x-cms-hidden`, `x-cms-preview`, but **none of the `x-cms-group-*` annotations**. Authors who want sibling fields to be visually grouped must restructure the JSON Schema (introducing a nested object → a Storyblok tab), which changes both data shape and the underlying website's rendering contract.

### 1.2 Storyblok grouping primitives are mis-allocated today

Storyblok offers three native grouping primitives:

1. **`type: tab`** — top-level horizontal tabs in a blok form. **Currently auto-generated for every nested non-component object** ([storyblok/index.ts L307-L325](../tools/jsonschema2storyblok/src/index.ts#L307)).
2. **`type: section`** — collapsible labeled section inside a tab; references members via a `keys[]` array. Declared on `IStoryblokSchemaElement` ([@types/index.ts L23, L73-L74](../tools/jsonschema2storyblok/src/@types/index.ts#L23)) but never emitted.
3. **Field-level `pos`** — already wired via `assignPositions()` ([storyblok/index.ts L226-L235](../tools/jsonschema2storyblok/src/index.ts#L226)).

The current allocation is backwards. Tabs — Storyblok's heaviest, most prominent UI separator — are spent on **incidental schema nesting** (any `type: object` property in the schema becomes a tab, regardless of whether the author wanted top-level UI structure there). Sections — the lighter, inline grouping primitive — are unused. As a consequence:

- Authors cannot put two unrelated nested objects under one tab. Each object is forced to its own tab.
- Authors cannot group sibling primitive fields that happen to share a logical purpose ("SEO", "Layout") under any visual container.
- The eventual `x-cms-group-name` annotation has no good slot left: tabs are taken by structure, sections are unused.

**Proposed re-allocation:**

| Primitive | Today | Proposed |
|---|---|---|
| `type: tab` | Per nested non-component object (incidental, structure-driven) | **Per `x-cms-group-name` value** (explicit, author-driven) |
| `type: section` | Unused | **Per nested non-component object** (incidental, structure-driven) |

This matches Stackbit's mental model better — in Stackbit, `fieldGroups` are explicit author intent and nested objects remain nested objects. In Storyblok we get a stronger version because we have two primitives to spend: tabs become the explicit-intent layer (the equivalent of Stackbit `fieldGroups` in spirit, even though Stackbit renders groups as collapsibles rather than tabs), sections become the structural layer.

### 1.3 Inline mutates keys → website renderers break without an inverse

Stackbit `fieldGroups` are **purely editor-view metadata**: each field carries a `group: '<name>'` reference, and the model carries a `fieldGroups[]` descriptor list. The **storage shape (key paths) is unchanged**. Stored content keys still match the original JSON Schema. No inverse transform is required for downstream renderers.

`x-cms-group-inline` is fundamentally different. It:

- Removes the wrapper object field.
- Hoists each child into the parent.
- Renames each child key to `<wrapper>__<childKey>`.

In Stackbit this still has no website-side consequence, because Stackbit/Netlify Create stores content keyed by the model's effective field names — which are the post-transform names. The CMS and the website agree on the inlined keys.

In Storyblok, the situation is identical in principle: Storyblok stores content under whatever keys the blok schema defines. If we emit a blok with key `cta__label` instead of nested `cta.label`, content authored in Storyblok will be delivered as `cta__label`. **The website's existing JSON Schema-driven renderer expects `cta.label`.** Without an inverse transformation, content created against a CMS-annotated schema cannot be rendered by code generated from the un-annotated base schema.

The same problem applies, more subtly, to any future key-mutating annotation we add (e.g., section-implied prefixing, plunge into a synthetic group object, etc.).

### 1.4 We have an unused asset: Cambria

The `@kickstartds/cambria` package provides bidirectional schema/data transformations via lens files. Its `lens-ops` ([tools/cambria/src/lens-ops.ts](../tools/cambria/src/lens-ops.ts)) include:

| Cambria op | Inverse | Use case for our annotations |
|---|---|---|
| `rename` | `rename` (swapped) | `cta__label` ↔ `cta.label` (when combined with `in`/`hoist`) |
| `hoist` | `plunge` | Move a child key out of a nested object into the parent |
| `plunge` | `hoist` | Move a parent key into a nested object |
| `in` | `in` | Scope a sub-lens to a property |
| `map` | `map` | Apply a sub-lens to each array item |

The `hoist`/`plunge` pair is the exact bidirectional encoding of `x-cms-group-inline`. Cambria can therefore generate a lens that — applied forward — transforms data authored against the un-annotated schema into the inlined CMS shape, and — applied in reverse via `reverseLens()` — transforms CMS-stored data back into the website's expected nested shape.

Today no code generates such lenses; users must hand-author them.

---

## 2. Goals

| # | Goal | Measured by |
|---|------|-------------|
| G1 | Storyblok converter emits `type: tab` elements driven by `x-cms-group-name`/`-title` (explicit author grouping) | Annotated sibling fields appear under a labeled tab in the generated blok schema |
| G2 | Storyblok converter emits `type: section` elements for nested non-component objects (structural grouping) | Each nested object renders as a collapsible section, replacing the current per-object tab behavior |
| G3 | Storyblok converter implements `x-cms-group-inline` with key prefixing identical to Stackbit | Wrapped object's fields appear at parent level with `<wrapper>__<child>` keys |
| G4 | A new utility in `@kickstartds/jsonschema-utils` (or a sibling tool) generates Cambria lenses describing every key-mutating transform applied to a schema | Given an annotated schema, a `.lens.yml` file is produced |
| G5 | Generated lenses round-trip: forward transforms un-annotated content into CMS shape; reverse transforms CMS content back | Property-based tests confirm `reverseLens(forward) ∘ forward = id` on representative documents |
| G6 | Stackbit converter produces the same lens output (for `x-cms-group-inline`) so renderers built on the un-annotated base can consume Stackbit data too | Same lens generator, exercised by Stackbit examples, produces working inverse |
| G7 | Conceptual parity with Stackbit: `x-cms-group-name` is the single explicit grouping primitive across both converters | Same annotation produces the equivalent UI affordance (Stackbit collapsible group, Storyblok tab); same lens output for `x-cms-group-inline` |

---

## 3. Non-Goals

- Replacing or restructuring existing Cambria lens authoring; we add a *generator*, not a new lens dialect.
- Generating lenses for editor-view-only annotations (`x-cms-order`, `x-cms-label`, `x-cms-group-name`, `x-cms-group-title`, `x-cms-group-icon`, `x-cms-hidden`, `x-cms-preview`). These do not mutate keys or values, so the identity lens is correct.
- Inferring lenses for arbitrary schema diffs. The generator is purely annotation-driven: we emit a lens op only for an annotation we own and whose semantics we control.
- Storyblok section icons (Storyblok `section` has no native `icon` property). `x-cms-group-icon` is best-effort: dropped, or encoded into `description`.
- Cross-component lenses (lens composition across multiple bloks). Each component's annotated schema produces one lens; multi-component pipelines are user-assembled.

---

## 4. Design

### 4.1 Annotation semantics in Storyblok

| Annotation | Storyblok output | Mutates keys? | Inverse needed |
|---|---|---|---|
| `x-cms-group-name` | Field's tab membership (via `keys[]` on a `type: tab` element) | No | No |
| `x-cms-group-title` | Tab element's `display_name` | No | No |
| `x-cms-group-icon` | Best-effort: tab `description` or dropped (Storyblok tab/section have no native `icon`) | No | No |
| `x-cms-group-inline` | Splice children into parent, prefix with `<wrapper>__` | **Yes** | **Yes** |
| (no annotation, plain nested object) | `type: section` element wrapping that object's fields | No | No |

Only `x-cms-group-inline` requires lens generation. The other three plus the structural section synthesis are pure UI metadata.

#### Interaction matrix

| Schema construct | Without `x-cms-group-name` | With `x-cms-group-name: "foo"` |
|---|---|---|
| Sibling primitive fields | Loose at root of blok | Bundled into tab `foo` |
| Nested object property | Section element with object's fields | Section element, **and** that section sits inside tab `foo` (section's `key` listed in tab's `keys[]`) |
| Nested object with `x-cms-group-inline: true` | Inline children into parent (no section, no tab) | Inline children, then bundle prefixed keys into tab `foo` |
| Component / template / global | Becomes own blok (unchanged) | Wrapping field bundled into tab `foo` of its parent blok |

### 4.2 Storyblok converter changes

#### 4.2.1 Type plumbing

Extend `IStoryblokSchemaElement` ([@types/index.ts](../tools/jsonschema2storyblok/src/@types/index.ts)) with a transient `group?: string` marker (analogous to Stackbit `Field.group`), stripped before serialization.

Extend `isCmsAnnotatedSchema` to declare `x-cms-group-name`, `x-cms-group-title`, `x-cms-group-icon`, `x-cms-group-inline`.

#### 4.2.2 Reading annotations

Mirror Stackbit's pattern in every `process*` function:

```ts
if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-name'])
  field.group = subSchema['x-cms-group-name'];
if (isCmsAnnotatedSchema(subSchema) && subSchema['x-cms-group-inline'])
  field.group = `INLINE__${name}`;
```

Touch points: `processObject` (array-parent and tab branches), `processRef`, `processRefArray`, `processArray`, `processEnum`, `processBasic`. Same surface as the existing `x-cms-preview` plumbing.

#### 4.2.3 Inline pass

Replicate the `traverse(... INLINE__ ...)` pass from [stackbit/index.ts L88-L116](../tools/jsonschema2stackbit/src/index.ts#L88), scoped to each blok schema. For each field whose `group` starts with `INLINE__`, locate its `objectFields`, splice them into the parent's schema record, prefix each key with `<parent>__`, copy the inner field's `group`. Drop the wrapper field. Run before `assignPositions()`.

#### 4.2.4 Section synthesis (structural grouping for nested objects)

Replace the current behavior in [storyblok/index.ts L307-L325](../tools/jsonschema2storyblok/src/index.ts#L307) where a nested non-component object becomes a `tab`. Instead emit a `type: section` element:

- `key`: stable id (e.g., `section-<name>` or uuid prefixed for collision safety)
- `display_name`: object's `x-cms-label` / `title` / `toPascalCase(name)` (existing `resolveDisplayName`)
- `keys`: prefixed child keys (`<name>_<childKey>`), same as today's tab logic

The child-key prefixing logic stays identical to today's tab branch; only the emitted `type` and the surrounding container change. This means content storage paths are **unchanged** from today's tab-based output — no lens generation needed for this transformation, the existing data shape is preserved.

#### 4.2.5 Tab synthesis (explicit grouping via `x-cms-group-name`)

Inside `createBlokSchema`, after sort/inline/section synthesis but before `assignPositions`:

1. Walk all fields (now including section elements), bucket by non-`INLINE__` `group` value.
2. For each bucket, emit one `IStoryblokSchemaElement` of `type: 'tab'`:
   - `key`: `tab-<groupName>` or stable uuid
   - `display_name`: `x-cms-group-title` (carried via a parallel descriptor map populated in `processObject`) or `toPascalCase(groupName)`
   - `keys`: member keys in their already-sorted order (sections appear here as single entries)
   - `description`: optionally derived from `x-cms-group-icon`
3. Insert the tab element at the position of its first member.
4. Strip `group` from members so it doesn't leak into output.

`assignPositions()` requires no change — it iterates `Object.values()` in insertion order and tabs will already sit in the right slot.

**Ungrouped fields** (no `x-cms-group-name`) remain at the root of the blok schema. Mixing tabs with ungrouped root fields is supported by Storyblok.

### 4.3 Cambria lens generator

#### 4.3.1 Where it lives

A new export in `@kickstartds/jsonschema-utils`, e.g. `generateLens(schema, annotatedSchema): LensSource`. It is converter-agnostic: any tool that consumes a CMS-annotated schema can call it to produce the lens for the round-trip back to the un-annotated schema. Storyblok and Stackbit examples both invoke it.

The output is the in-memory `LensSource` from [tools/cambria/src/lens-ops.ts](../tools/cambria/src/lens-ops.ts). A small serializer (or the existing Cambria YAML loader inverted) writes it to `.lens.yml`.

#### 4.3.2 Algorithm

Given:
- `baseSchema`: the un-annotated source schema (as authored in `kickstartds/`).
- `annotatedSchema`: the same schema after layering with the CMS layer (post-`allOf` merge, but pre-converter).

Walk `annotatedSchema`. For each property, emit lens ops based on annotations encountered:

| Annotation found | Lens op(s) emitted |
|---|---|
| `x-cms-group-inline: true` on property `P` of object `O` | One `hoist` per child of `P`, then `rename` each to `P__<child>` (forward direction) |
| Future key-mutating annotations | Mapped 1:1 to Cambria ops |
| Editor-view annotations | None (identity in lens space) |

Pseudocode for inline:

```ts
function lensForInline(parentName: string, wrapperProp: JSONSchema): LensOp[] {
  const ops: LensOp[] = [];
  for (const childKey of Object.keys(wrapperProp.properties ?? {})) {
    ops.push({ op: 'hoist', name: childKey, host: parentName });
    ops.push({ op: 'rename', source: childKey, destination: `${parentName}__${childKey}` });
  }
  return ops;
}
```

Recursion: nested objects use `op: 'in'` to scope sub-lenses; arrays of objects use `op: 'map'`.

#### 4.3.3 Bidirectionality

Cambria lenses are bidirectional by construction. The generator emits the **forward** lens (un-annotated → CMS-shape). The runtime consumer (the website's data-loading layer) calls `reverseLens(lens)` once and applies it to CMS payloads to recover the original shape. No separate "reverse generator" is needed.

`hoist` ↔ `plunge` and symmetric `rename` are the only inverses we exercise; both are well-tested in Cambria.

#### 4.3.4 Per-component output

For each component schema processed by a converter, the generator produces one lens. The converter pipeline gains an optional sibling artifact:

```
dist/storyblok/components.json     # CMS configuration (today)
dist/storyblok/lenses/<name>.lens.yml   # NEW: forward lens per component
```

Consumers wire the lenses into their data pipeline (e.g., a Storyblok Content Delivery API middleware that runs `applyLensToDoc(reverseLens(lens), payload, ...)`).

### 4.4 Stackbit parity

The lens generator is invoked from the Stackbit example as well. For Stackbit, only `x-cms-group-inline` produces a non-identity lens (everything else is `fieldGroups` metadata, which is editor-view only and does not mutate stored keys). This gives Stackbit users the same round-trip guarantee for free, and verifies the generator is converter-agnostic.

### 4.5 Layering compatibility

`x-cms-group-*` annotations are added in the `cms/` layer via `allOf` merge, mirroring `x-cms-hidden`/`x-cms-preview`. The lens generator runs against the **post-merge** schema, so layering integrates naturally. Authors of base schemas in `kickstartds/` need no changes.

---

## 5. Implementation Plan

### Phase 1a: Re-allocate primitives — nested objects → sections

1. Change the nested-object branch in `processObject` ([storyblok/index.ts L307-L325](../tools/jsonschema2storyblok/src/index.ts#L307)) to emit `type: 'section'` instead of `type: 'tab'`. Child-key prefixing logic stays identical.
2. Regenerate fixtures, confirm content storage paths are unchanged (only the wrapping element type differs).
3. Snapshot tests for the converter output.

### Phase 1b: Storyblok explicit grouping (no key mutation)

1. Extend `isCmsAnnotatedSchema` and `IStoryblokSchemaElement` with the four `x-cms-group-*` keys.
2. Read `x-cms-group-name` in every `process*` function and store on `field.group`.
3. Synthesize `type: tab` elements inside `createBlokSchema`, threading `x-cms-group-title` through.
4. Add an example in `examples/storyblok/resources/` exercising both tabs (groups) and sections (nested objects), including the case of a nested-object section nested inside a tab.
5. Regenerate fixtures, snapshot in tests.

### Phase 2: Storyblok inline (key-mutating, no inverse yet)

1. Implement the `INLINE__` pass mirroring [stackbit/index.ts L88-L116](../tools/jsonschema2stackbit/src/index.ts#L88).
2. Add example schema with `x-cms-group-inline: true`.
3. Verify generated blok schema has flattened, prefixed keys.

### Phase 3: Cambria lens generator

1. New utility `generateLens(schema): LensSource` in `@kickstartds/jsonschema-utils`. Initially handles only `x-cms-group-inline` (the only Phase-2 mutating annotation).
2. Unit tests: forward lens emits expected `hoist`+`rename` sequence; `reverseLens()` round-trips representative documents.
3. YAML serialization helper (or reuse Cambria's loader, applied inversely).
4. Wire into `examples/storyblok/src` and `examples/stackbit/src` to emit `.lens.yml` siblings of the CMS configs.

### Phase 4: Renderer-side documentation

1. Document the consumer pattern in [ARCHITECTURE.md](ARCHITECTURE.md): how to load the generated lens at runtime and apply `reverseLens()` to CMS payloads.
2. End-to-end example in `examples/storyblok` (or new `examples/storyblok-runtime`) showing CMS payload → reverse lens → original schema shape.

### Phase 5 (deferred): Generalize generator

Extend `generateLens` to support future key-mutating annotations by registering generators per annotation name (registry pattern, mirroring `getSchemaRegistry()`).

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cambria's `hoist`/`plunge` doesn't compose with our nested `in`/`map` scopes as expected | Medium | High | Build small test harness in Phase 3 step 2 before wiring into examples; surface failures early |
| Generated lens diverges from converter behavior (drift) | High | High | Treat the generator as the single source of truth for any key transform; converter implements the same op semantics or imports the transform from the generator's primitive helpers |
| Lens YAML grows unmanageable for deeply nested schemas | Low | Low | Cambria's `in` op scopes lens fragments; output remains a tree, not a flat list |
| Cambria package is "immature" (per upstream README) | Low | Medium | Our fork is vendored; we control regressions. Expand test coverage as a side effect |
| Section icons can't map to Storyblok | Certain | Low | Document as known limitation; consider encoding into `description` |
| `x-cms-group-inline` on a `$ref`'d component creates conflicting keys with sibling fields | Medium | Medium | Detect and throw at generator time with a clear error pointing to the offending property |

---

## 7. Open Questions

1. **Should the lens generator emit one lens per component or one combined lens per schema set?** Leaning per-component (matches converter granularity, easier consumer wiring), but combined would reduce loader overhead.
2. **Should generated lenses be checked in (generated artifacts) or always regenerated at build time?** Recommend regenerated at build time alongside CMS configs, treating both as the same generated output category.
3. **Do we need a forward-only mode for consumers that only read CMS data?** Probably no — `reverseLens()` is cheap and runs once per process boot.
4. **What about `x-cms-hidden` interaction with lenses?** Hidden fields are still stored in CMS payloads (just invisible in the editor). The lens does not need to do anything for them; identity transform suffices.
5. **Phase 1a is a breaking change for existing Storyblok installs** — bloks regenerate with `section` instead of `tab` containers. Storyblok's `keys[]` association is by key, so stored content under prefixed keys (e.g., `headline_text`) is preserved verbatim, and the change is purely UI. Confirm with a Storyblok test environment before release.
6. **Should `x-cms-group-name` on a top-level component schema produce a tab, or be ignored?** Components already have an outer blok; nested annotation on the root is currently undefined. Recommend ignoring at root level and treating as property-level only.

---

## 8. Success Criteria

- [ ] Storyblok converter emits `type: section` elements for nested non-component objects (replacing today's tab behavior)
- [ ] Storyblok converter emits `type: tab` elements when `x-cms-group-name` is present, with member fields (including sections) listed in `keys[]`
- [ ] Mixed bloks (some fields grouped, some root-level, some sectioned) generate valid Storyblok schemas
- [ ] Storyblok converter implements `x-cms-group-inline` with `<wrapper>__<child>` keys, matching Stackbit's behavior
- [ ] `generateLens(schema)` emits a Cambria `LensSource` that, applied forward, produces a document matching the inlined shape
- [ ] `reverseLens(generateLens(schema))` applied to an inlined document recovers the original nested shape, byte-for-byte (excluding type-coerced numerics)
- [ ] Both Storyblok and Stackbit examples produce `.lens.yml` siblings of their CMS configs
- [ ] Round-trip property test passes on at least three representative example schemas (e.g., `headline`, `cta`, a nested layout component)
- [ ] Documentation in `ARCHITECTURE.md` covers the lens consumer pattern with a concrete code snippet

---

## 9. Reference Notes — Stackbit's behavior

For the record, since this PRD turns on the contrast:

- Stackbit `fieldGroups` are pure editor metadata. Each `Field` carries `group: '<name>'` and the model carries `fieldGroups: FieldGroupItem[]`. Storage paths are unchanged. **No inverse needed.**
- Stackbit `x-cms-group-inline` does mutate effective field keys (`<wrapper>__<child>`), but in Stackbit's storage model the CMS persists content under those mutated keys, and the website renderer is expected to read those keys directly. There is **no built-in Stackbit inverse**. This works in the Stackbit ecosystem because website code typically reads from the same model definition the CMS uses.
- For kickstartDS, the website renderer is generated from the **un-annotated base schema**, not the CMS-annotated layer. That is why we need an inverse — and why a Cambria-based generator is the right tool: it formalizes the contract and makes it auditable per component.
