# Implementation Checklist: `x-cms-order` & Display Name Improvements

Tracks progress against [PRD-x-cms-order-and-display-name.md](PRD-x-cms-order-and-display-name.md).

---

## Phase 1: Core Infrastructure (`@kickstartds/jsonschema-utils`)

- [x] Register `x-cms-order` keyword in `getSchemaRegistry()` (`helpers.ts`)
- [x] Register `x-cms-label` keyword in `getSchemaRegistry()` (`helpers.ts`)
- [x] Add `sortPropertiesByOrder()` utility function (`helpers.ts`)
- [x] Export `sortPropertiesByOrder` from `index.ts` (automatic via `export *`)
- [x] Replace `Object.keys(schema.properties)` iteration in `buildComponent()` with sorted order (`reduce.ts`)
- [x] Replace `Object.keys(reffedSchema.properties)` iteration in `buildType()` ref branch with sorted order (`reduce.ts`)
- [x] Replace `Object.keys(schema.properties)` iteration in `buildType()` object branch with sorted order (`reduce.ts`)
- [x] Add `label` field to `IProcessInterface` for `x-cms-label` passthrough (`reduce.ts`)
- [x] Pass `x-cms-label` value from subschema into `buildType()` calls (`reduce.ts`)
- [ ] Verify `x-cms-order` survives `deepMerge()` in `allOf` processing (manual test)

## Phase 2: Storyblok Converter (`@kickstartds/jsonschema2storyblok`)

- [x] Add `assignPositions()` helper function to set `pos` from iteration index (`index.ts`)
- [x] Apply `assignPositions()` after every `createBlokSchema()` call (`index.ts`)
- [x] Add `resolveDisplayName()` helper implementing `x-cms-label → title → toPascalCase(key)` chain (`index.ts`)
- [x] Update `processObject` — use `resolveDisplayName()` for `display_name` (`index.ts`)
- [x] Update `processRef` — use `resolveDisplayName()` for `display_name` (`index.ts`)
- [x] Update `processRefArray` — use `resolveDisplayName()` for `display_name` (`index.ts`)
- [x] Update `processArray` — use `resolveDisplayName()` for `display_name` (`index.ts`)
- [x] Update `processEnum` — use `resolveDisplayName()` for `display_name` (`index.ts`)
- [x] Update `processBasic` — use `resolveDisplayName()` for `display_name` (`index.ts`)
- [x] Update `processConst` / `getInternalTypeDefinition` — kept `toPascalCase(typeResolutionField)` (internal field, no user label)
- [x] Update TODO comment at line 55 — mark `pos` handling as resolved (`index.ts`)

## Phase 3: Improved `toPascalCase` (`@kickstartds/jsonschema-utils`)

- [x] Replace `toPascalCase()` with camelCase/underscore-aware implementation (`helpers.ts`)
- [x] Remove now-unused `clearAndUpper()` function (`helpers.ts`)
- [x] Verify no other callers of `clearAndUpper()` exist

## Verification

- [x] `jsonschema-utils` builds successfully (`heft build --clean`)
- [x] `jsonschema2storyblok` builds successfully (`heft build --clean`)
- [ ] Full monorepo `rush rebuild` succeeds
