# Implementation Checklist: Storyblok Grouping & Cambria Inverse Transforms

Tracks progress against [PRD-storyblok-grouping-and-inline.md](PRD-storyblok-grouping-and-inline.md). Architectural decisions captured in [ADR-storyblok-grouping-and-inline.md](ADR-storyblok-grouping-and-inline.md).

---

## Phase 1a: Re-allocate primitives — nested objects → sections

- [x] Change nested-object branch in `processObject` (`storyblok/index.ts` ~L307-L325) to emit `type: 'section'` instead of `type: 'tab'`
- [x] Verify child-key prefixing logic remains identical (`<name>_<childKey>`)
- [x] Update converter typings if needed (added `'section'` to `GenericType` union)
- [x] Regenerate Storyblok example fixtures (`dist/agency/components.123456.json`: 118 section elements, 0 tabs)
- [x] Confirm content storage paths unchanged (UI-only diff: identical `<name>_<childKey>` keys)
- [ ] Snapshot tests pass (no existing snapshot tests in package; deferred)

## Phase 1b: Storyblok explicit grouping (`x-cms-group-name` → tabs)

- [x] Extend `isCmsAnnotatedSchema` with `x-cms-group-name`, `x-cms-group-title`, `x-cms-group-icon`, `x-cms-group-inline` (`storyblok/index.ts`)
- [x] Add transient `group?: string` field to `IStoryblokSchemaElement` (`@types/index.ts`); also `groupTitle?`, `groupIcon?`
- [x] Read `x-cms-group-name` in every `process*` function and store on `field.group` (via `applyGroupAnnotations()` helper)
- [x] Carry group descriptor (title, icon) on the same transient field markers — simpler than a parallel map
- [x] Implement tab synthesis pass inside `createBlokSchema`:
  - [x] Bucket fields by `group` value (excluding `INLINE__*`)
  - [x] Emit one `type: 'tab'` element per bucket with `display_name`, `keys[]`
  - [x] Insert tab at position of first member; strip transient markers from members
- [x] Verify `assignPositions()` correctly orders tabs (no code change required)
- [x] Add Storyblok example annotations exercising tabs + sections + nested-section-in-tab (hero schema)
- [x] Regenerate fixtures, verified tabs nest sections correctly:
  - `tab-content` → `[headline, sub, text, buttons]`
  - `tab-media` → `[section-...]` → image fields

## Phase 2: Storyblok inline (`x-cms-group-inline` — key-mutating)

- [x] Read `x-cms-group-inline` in `processObject`, set `field.inline = name` (carries wrapper property name)
- [x] Implement inline pass in `createBlokSchema` (mirror of `stackbit/index.ts` L88-L116) scoped to each blok schema
  - [x] Splice wrapper's `objectFields` into parent's schema record
  - [x] Re-prefix each child key from `<wrapper>_<child>` to `<wrapper>__<child>`
  - [x] Propagate wrapper's `group`/`groupTitle`/`groupIcon` to hoisted children (so they can join tabs at parent level)
  - [x] Drop the wrapper field
- [x] Inline pass runs before tab synthesis and `assignPositions` (in `createBlokSchema` reduce step)
- [x] Add example schema with `x-cms-group-inline: true` (hero `image` property)
- [x] Verify generated blok schema has flattened, prefixed keys: `image__srcMobile`, ..., `image__alt` listed directly in `tab-media`'s `keys[]`

## Phase 3: Cambria lens generator (`@kickstartds/jsonschema-utils`)

- [x] Add `generateLens(schema): LensSource` utility (`tools/jsonschema-utils/src/lens-generator.ts`)
- [x] Initial scope: `x-cms-group-inline` only
  - [x] Emit `hoist` per child of inline wrapper
  - [x] Emit `rename` per child to `<wrapper>__<child>`
  - [x] Emit `remove` of empty wrapper after hoist+rename pairs
  - [x] Wrap recursive lenses in `op: 'in'` for nested context
  - [x] Wrap recursive lenses in `op: 'map'` for arrays of objects
- [x] Recurse into nested objects and arrays
- [x] Conflict detection: inline child key clashing with sibling throws clear error
- [x] YAML serialization helper (`dumpYamlLens` / `dumpLens` added to `@kickstartds/cambria`)
- [x] Wire into `examples/storyblok/src` to emit `.lens.yml` siblings under `dist/agency/lenses/`
- [x] Round-trip verified on hero schema (forward+`reverseLens()` recovers original shape)
- [ ] Wire into `examples/stackbit/src` to emit `.lens.yml` siblings
- [ ] Unit tests in `tools/jsonschema-utils/test/lens-generator.test.ts`
- [ ] Round-trip property tests on at least three example schemas

## Phase 4: Renderer-side documentation

- [ ] Document consumer pattern in `ARCHITECTURE.md` with concrete `applyLensToDoc(reverseLens(lens), ...)` snippet
- [ ] End-to-end example showing CMS payload → reverse lens → original schema shape

## Phase 5 (deferred): Generalize generator

- [ ] Annotation registry pattern for future key-mutating annotations

## Verification

- [ ] `jsonschema-utils` builds successfully
- [ ] `jsonschema2storyblok` builds successfully
- [ ] `cambria` builds successfully
- [ ] Full `rush rebuild` succeeds
- [ ] All snapshot/round-trip tests green
