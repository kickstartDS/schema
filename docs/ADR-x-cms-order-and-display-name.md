# ADRs: `x-cms-order` & Display Name Improvements

Architectural Decision Records for the [PRD](PRD-x-cms-order-and-display-name.md). Captures notable technical decisions made during implementation.

---

## ADR-001: Ordering applied in reducer, not in individual converters

**Context:** Field ordering via `x-cms-order` could be applied in two places: (a) centrally in `getSchemaReducer()` where properties are iterated, or (b) in each converter's process functions.

**Decision:** Apply ordering centrally in the reducer (`reduce.ts`), by sorting `Object.keys(schema.properties)` via `sortPropertiesByOrder()` before passing fields to process functions.

**Rationale:**
- Single point of change — all converters benefit automatically
- Converters already receive fields as an array in `IProcessInterface.fields`; order of that array is what matters
- Avoids duplicating sort logic across 8+ converter packages
- The reducer already owns the property iteration logic (`buildComponent`, `buildType`)

**Consequences:**
- All converters will see field order changes, not just Storyblok
- Converters that had their own ordering (StaticCMS's `sortFieldsDeep()`) may produce different results — this is accepted as out of scope per PRD

---

## ADR-002: `pos` assigned via post-processing, not per-process-function

**Context:** Storyblok fields need a `pos` integer. We could either: (a) pass a position index into each process function and set `pos` inline, or (b) leave `pos: 0` in process functions and assign positions in a post-processing step after the schema record is assembled.

**Decision:** Post-processing via `assignPositions()` called after `createBlokSchema()`.

**Rationale:**
- Process functions don't know their position among siblings — they receive one field at a time
- `createBlokSchema()` flattens `objectFields` into the schema record, which changes the field count — position must be assigned after flattening
- Cleaner separation: process functions define field structure, post-processing assigns layout metadata

**Consequences:**
- All `pos: 0` hardcoded values remain in process functions (they're overwritten by post-processing)
- Tab fields get positions relative to their siblings, including flattened `objectFields`

---

## ADR-003: Display name resolution chain `x-cms-label → title → toPascalCase(key)`

**Context:** Display names could be derived from multiple sources. Need to define precedence.

**Decision:** Three-tier resolution: `x-cms-label` (explicit CMS override) → `title` (standard JSON Schema) → `toPascalCase(key)` (computed fallback).

**Rationale:**
- `title` is the natural JSON Schema metadata field, but it serves double duty (documentation/tooltips vs. editor labels)
- `x-cms-label` provides an unambiguous, CMS-specific override when `title` isn't the right label
- `toPascalCase` is the last resort when no schema metadata is provided
- All three sources are layerable via `allOf` merge

**Consequences:**
- The `title` parameter already flows through `IProcessInterface` from the reducer
- `x-cms-label` requires a new field (`label`) on `IProcessInterface`
- Existing schemas without `title` or `x-cms-label` continue to work unchanged (fall through to `toPascalCase`)

---

## ADR-004: `toPascalCase` breaking change accepted

**Context:** Improving `toPascalCase` to handle camelCase boundaries and underscores changes all generated display names across all converters.

**Decision:** Accept the breakage. Ship as part of this work.

**Rationale:**
- Labels are display-only — they don't affect stored data or content structure
- Downstream projects can override via `x-cms-label` or `title` layering (both shipping in this same change)
- Gating behind a flag adds complexity for marginal benefit
- The new behavior is strictly more correct

**Consequences:**
- All CMS instances using generated labels will see label changes on next config push
- Example fixture files (`resources/config.json` etc.) will change

---

## ADR-005: `x-cms-label` passed through `IProcessInterface` as `label` field

**Context:** The reducer needs to convey `x-cms-label` from the schema to process functions. Options: (a) add a `label` field to `IProcessInterface`, (b) leave it on `subSchema` and let converters extract it themselves.

**Decision:** Add a `label` field to `IProcessInterface` and populate it in the reducer.

**Rationale:**
- Consistent with how `title` already flows through `IProcessInterface`
- Converters shouldn't need to know about `x-cms-*` keyword extraction — the reducer handles schema mechanics
- Type-safe: `label: string` on the interface vs. `(subSchema as any)['x-cms-label']` in every converter

**Consequences:**
- `IProcessInterface` gets a new optional field — this is a minor type change but non-breaking since it's additive
- All existing process function implementations continue to work without changes (they just ignore the new field until updated)

---

## ADR-006: `sortPropertiesByOrder` uses `Record<string, unknown>` parameter type

**Context:** `schema.properties` has type `Record<string, JSONSchema>` where `JSONSchema = JSONSchema.Interface | false`. The original `sortPropertiesByOrder` signature used `Record<string, JSONSchema.Interface>`, causing TypeScript errors since `false` isn't assignable to `JSONSchema.Interface`.

**Decision:** Widen the parameter type to `Record<string, unknown>` and cast `prop` to `JSONSchema.Interface` at the call site via `structuredClone(prop) as JSONSchema.Interface`.

**Rationale:**
- The function only reads `x-cms-order` from each value via `as Record<string, unknown>` internally — it doesn't need the full JSON Schema type
- Callers already know they're working with schema properties and cast appropriately
- Avoids importing `JSONSchema` types into `helpers.ts` just for this utility
- The optional chaining (`?.['x-cms-order']`) makes the access safe even if a property value is `false`

**Consequences:**
- Return type is `[string, unknown][]` — callers must cast the second element when they need typed access
- Three call sites in `reduce.ts` add `as JSONSchema.Interface` after `structuredClone(prop)`
