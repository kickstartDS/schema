# ADRs: Storyblok Grouping & Cambria Inverse Transforms

Architectural Decision Records for the [PRD](PRD-storyblok-grouping-and-inline.md). Captures notable technical decisions made during implementation. Updated as decisions emerge.

---

## ADR-001: Re-allocate Storyblok grouping primitives

**Context:** Storyblok offers `type: tab` and `type: section`. Today, `tab` is auto-generated for every nested non-component object, leaving `section` unused and no native primitive available for explicit author-driven grouping (`x-cms-group-name`).

**Decision:** Invert the allocation. `type: tab` carries explicit author grouping (`x-cms-group-name`); `type: section` carries incidental schema nesting (any `type: object` property).

**Rationale:**
- Tabs are Storyblok's most prominent UI separator; spending them on author intent matches their visual weight.
- Sections are lighter, collapsible, and naturally "this is a sub-shape of the parent" — a perfect fit for nested objects.
- Aligns mental model with Stackbit's `fieldGroups`: explicit grouping is annotation-driven; nested objects remain incidental.
- Two primitives to spend gives Storyblok strictly more expressiveness than Stackbit, not less.

**Consequences:**
- Breaking UI change for existing Storyblok installs (accepted per user direction).
- Stored content paths unchanged — the `<wrapper>_<child>` prefixing logic that today runs in the tab branch is preserved verbatim in the section branch.
- A tab can contain primitive fields **and** sections (a section's `key` lives in the tab's `keys[]`).

---

## ADR-002: `x-cms-group-inline` is the only key-mutating annotation

**Context:** Multiple annotations could conceivably mutate effective field keys. Need to draw a clear line between editor-view-only and key-mutating.

**Decision:** Only `x-cms-group-inline` mutates keys. All other `x-cms-*` annotations (`-name`, `-title`, `-icon`, `-order`, `-label`, `-hidden`, `-preview`) are pure UI metadata.

**Rationale:**
- Keeps the lens-generation surface minimal and auditable.
- Sections and tabs both use Storyblok's `keys[]` association mechanism — they reference existing field keys, never rename them.
- The structural section synthesis (Phase 1a) preserves today's `<wrapper>_<child>` prefixing because that logic predates any annotation work; it is a property of nested-object emission, not of grouping.

**Consequences:**
- Lens generator only handles `x-cms-group-inline`. Identity lens for everything else.
- Future key-mutating annotations require explicit lens-generator support; no implicit coverage.

---

## ADR-003: Lens generator is converter-agnostic, lives in `jsonschema-utils`

**Context:** The Cambria lens generator could live in each converter, or centrally.

**Decision:** Centralize as `generateLens(schema)` in `@kickstartds/jsonschema-utils`. Both Storyblok and Stackbit examples invoke it.

**Rationale:**
- The transformation it describes is a property of the schema annotations, not of the target CMS.
- Stackbit and Storyblok both implement `x-cms-group-inline` with identical key-prefixing semantics. The lens applies equally to both.
- Single source of truth prevents drift between converter behavior and lens output.

**Consequences:**
- Converters must implement key mutations consistent with the generator. Any divergence is a bug.
- Cambria becomes a runtime dependency for any project consuming CMS data through the converters' annotated schemas.

---

## ADR-004: Lens generation is annotation-driven, not diff-driven

**Context:** A lens could be inferred by diffing the un-annotated and annotated schemas.

**Decision:** Generate lens ops directly from annotations, not from schema diffs.

**Rationale:**
- Annotations carry intent; diffs carry only mechanics. Intent-driven generation is more predictable and gives clearer error messages.
- Diff-based inference would re-derive what the converter already knows.
- Enables fail-fast errors (e.g., inline key conflict) at generation time with annotation-pointing context.

**Consequences:**
- Adding a new key-mutating annotation requires updating the generator. No magical coverage.
- The generator and the converter share an annotation contract that must stay in sync.

---

## ADR-005: Per-component lens output

**Context:** Lens output could be one combined file per schema set or one file per component.

**Decision:** One `.lens.yml` per component, sibling to the converter's per-component output.

**Rationale:**
- Matches converter granularity; easier to reason about and version.
- Storyblok and Stackbit both produce per-component CMS configs already.
- Consumer wiring stays simple: load the lens for the component being rendered.

**Consequences:**
- More files in the build output, but each is small.
- Combined-loader scenarios (one big lens) are out of scope; users assemble at consumption time.

---

## ADR-006: Group descriptor on the field, not in a parallel map

**Context:** `x-cms-group-title` and `x-cms-group-icon` are needed at tab synthesis time inside `createBlokSchema`, but only the `x-cms-group-name` value lives on the field as a transient marker. Need to surface title/icon somehow.

**Decision:** Add transient `groupTitle?` and `groupIcon?` markers alongside `group?` directly on `IStoryblokSchemaElement`. Strip all three at output via `stripTransientMarkers()`.

**Rationale:**
- Avoids threading a second data structure through `processObject`/`processRef`/etc.
- Same lifecycle as `objectFields` (transient → stripped before serialization).
- First member of a group "wins" for the title/icon \u2014 if multiple members carry conflicting titles, deterministic by source order; in practice authors only set them once.

**Consequences:**
- The `IStoryblokSchemaElement` type carries three transient fields that must be stripped before output. `stripTransientMarkers()` is the single place this happens.
- Adding more group-level metadata (e.g., default-collapsed) follows the same pattern.

---

## ADR-007: Tab keys are deterministic (`tab-<groupName>`), section keys remain uuid-prefixed

**Context:** Tab synthesis needs a unique key in the blok schema record. Sections use `section-<uuid>`.

**Decision:** Tabs use `tab-<groupName>`; sections retain `section-<uuid>`.

**Rationale:**
- Group names are author-controlled and unique per blok by definition (a name identifies a group). Deterministic keys are easier to diff and review.
- Section keys derive from anonymous nested objects; uuid avoids collisions when multiple anonymous objects sit at the same level. Authors don't reference these keys.
- Storyblok treats `keys[]` as the binding mechanism; key format doesn't matter functionally.

**Consequences:**
- Two consecutive runs of the converter produce identical tab keys (good for git diffs).
- If two bloks share a group name, each gets its own `tab-<groupName>` scoped to its own schema record \u2014 no collision.
- A future schema author writing a property literally named `tab-foo` could collide. Acceptable given the underscore/dash convention in property keys.

---

## ADR-008: Inline marker carries wrapper name, not boolean

**Context:** Need to recover the wrapper property name during the inline hoist pass in `createBlokSchema`. The section element's own `key` is `section-<uuid>`, not `<name>`. Children carry `<name>_<child>` keys.

**Decision:** The transient `inline?` field on `IStoryblokSchemaElement` carries the wrapper property name as a string, not a boolean.

**Rationale:**
- Wrapper name is needed at hoist time to compute the `__` re-prefix; storing it on the element avoids reverse-engineering it from child keys.
- Stripped at output via `stripTransientMarkers()` like the other transient fields.
- Boolean would have required deriving the name from `objectFields[0].key.split('_')[0]`, which is fragile when child names contain underscores.

**Consequences:**
- The marker field has a slightly unusual non-boolean shape; documented in the type definition.

---

## ADR-009: Inline propagates parent's group annotation to hoisted children

**Context:** When `x-cms-group-inline: true` is combined with `x-cms-group-name: "foo"`, the wrapper itself disappears. Children must still end up in tab `foo` at the parent level.

**Decision:** During the hoist pass, copy `group`/`groupTitle`/`groupIcon` from the wrapper onto each child that doesn't already have its own group annotation.

**Rationale:**
- Matches PRD interaction matrix: inline+group means "place these flattened keys in the named tab".
- `&& !objectField.group` guard preserves child-level overrides (rare but possible).
- Verified empirically with hero `image` schema: prefixed `image__*` keys appear directly in `tab-media`'s `keys[]`.

**Consequences:**
- Tab synthesis still works on a flat record after inline; no special case needed.
- A nested object's children inherit "downward" only on inline, never on plain section emission (sections preserve nesting via `section`'s `keys[]`).

---


## ADR-010: Lens generator lives in `@kickstartds/jsonschema-utils`

**Context:** PRD §4.3 calls for a `generateLens(schema): LensSource` utility. Two viable homes: `@kickstartds/cambria` or `@kickstartds/jsonschema-utils`.

**Decision:** Place `generateLens` in `@kickstartds/jsonschema-utils` (`src/lens-generator.ts`), exported from the package root.

**Rationale:**
- Generator is schema-driven and converter-agnostic — every CMS converter that consumes `x-cms-group-inline` can reuse it (Stackbit, Storyblok, future PayloadCMS).
- Cambria stays the data-mechanics library (lens ops, `applyLensToDoc`, `reverseLens`); it has no opinion about JSON Schema annotations.
- `jsonschema-utils` already depends on `@kickstartds/cambria`, so importing `LensSource`, `LensOp`, and the helper constructors (`hoistProperty`, `renameProperty`, `removeProperty`, `inside`, `map`) is free.
- Renderer-side consumers depend on `@kickstartds/cambria` only (load YAML lens, reverse, apply); they don't pull in the generator.

**Consequences:**
- Generator is exposed alongside other schema utilities, discoverable from a single import.
- Cambria gets a small companion API addition (`dumpYamlLens`, `dumpLens`) for the inverse of `loadYamlLens` — needed by example sites and CI to write `.lens.yml` artifacts.

---

## ADR-011: Forward lens shape — hoist + rename + remove wrapper

**Context:** For each `x-cms-group-inline: true` wrapper `W` with children `c1..cN`, the lens must transform the un-annotated document into the CMS-shaped one (`W.cN` → `W__cN`, `W` removed).

**Decision:** Emit, for each child `cI` in declaration order:
1. `hoist { host: W, name: cI }` — moves `W.cI` to top-level `cI`
2. `rename { source: cI, destination: W__cI }` — namespaces it
3. (recursively) `in { name: W__cI, lens: <child lens> }` if the child has its own annotations

After all children are hoisted, emit `remove { name: W, type: object }` to drop the now-empty wrapper.

**Rationale:**
- `hoist` + `rename` is the only Cambria-supported way to flatten an object while preserving values; there is no `flatten` op.
- `reverseLens()` inverts each op natively (`hoist`↔`plunge`, `rename` swaps endpoints, `remove`→`add`), so the round-trip from CMS payload back to original shape works without custom inverse code.
- Verified empirically: a hero document with `image: { src, alt, indent, srcMobile, srcTablet, srcDesktop }` round-trips through `applyLensToDoc(reverseLens(lens), applyLensToDoc(lens, doc))` (key-order-insensitive equality).

**Consequences:**
- Generated lenses are O(N) in the number of inline children — verbose YAML but trivially auditable.
- Renaming `cI` while `cI` still exists at top-level on the source doc would conflict. The generator detects this at compile time: if any sibling on the same object literally equals `<wrapper>__<child>` it throws `Inline child '...' of '...' collides with existing sibling '...'` (PRD §6).

---

## ADR-012: Lens emitted per component name, not per layer-prefixed `$id`

**Context:** With layering enabled, the same logical component (e.g. `hero`) is registered against AJV under multiple `$id`s — one per layer (`http://schema.mydesignsystem.com/hero...`, `http://visibility.mydesignsystem.com/hero...`, etc.). Each layered schema sees the merged result, including all `x-cms-*` annotations.

**Decision:** In example sites, walk the returned `schemaIds` and dedupe by component name (`getSchemaName(schemaId)`); emit at most one `<name>.lens.yml` per component.

**Rationale:**
- The lens describes a content shape transformation; the layer prefix is a build-time concern, not a runtime one.
- Renderer-side consumers know components by name (or by the un-prefixed schema), not by layer host.
- Picking the first non-empty lens encountered is sufficient because layering merges all annotations into every layer's view by the time `processSchemaGlobs` returns.

**Consequences:**
- A component without any key-mutating annotation produces no lens file (zero-cost identity). Renderers should treat "no lens file" as "no transform needed".
- If a future use case demands per-layer lenses, the dedup strategy would need to change; for now there's no such requirement.
