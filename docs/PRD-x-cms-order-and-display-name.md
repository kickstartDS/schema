# PRD: Explicit Field Ordering (`x-cms-order`) & Display Name Improvements

**Status:** Draft  
**Author:** Auto-generated  
**Date:** 2026-03-09  
**Packages affected:** `@kickstartds/jsonschema-utils`, `@kickstartds/jsonschema2storyblok`

---

## 1. Problem Statement

### 1.1 Field Ordering

JSON Schema does not prescribe property ordering — `properties` is an unordered object by spec. In practice, most JSON implementations preserve insertion order, and the current converter tooling relies on this implicit ordering. This creates two problems:

1. **Fragility.** Schema layering, `allOf` merging, and reference inlining can shuffle property order. The final order a converter sees depends on processing internals, not on author intent.
2. **No override mechanism.** Downstream schema layers (e.g. a `cms/` layer) cannot reorder fields without redefining the entire `properties` block.

In Storyblok specifically, every field carries a `pos` integer that determines editor UI order. Today, **all `pos` values are hardcoded to `0`** (see the TODO at `tools/jsonschema2storyblok/src/index.ts` line 55). The result is nondeterministic field order in the Storyblok editor, making content entry confusing and inconsistent.

### 1.2 Display Names

All converters derive human-readable labels from the JSON Schema property key using `toPascalCase()`:

```typescript
// jsonschema-utils/src/helpers.ts, line 1000
export function toPascalCase(text: string): string {
  return text.replace(/(^\w|-\w)/g, clearAndUpper);
}
export function clearAndUpper(text: string): string {
  return text.replace(/-/, ' ').toUpperCase();
}
```

This has several shortcomings:

| Input | Current output | Expected output |
|-------|---------------|-----------------|
| `blog-teaser` | `Blog Teaser` | `Blog Teaser` (OK) |
| `backgroundColor` | `BackgroundColor` | `Background Color` |
| `cta_link` | `Cta_link` | `CTA Link` |
| `faq` | `Faq` | `FAQ` |
| `html_content` | `Html_content` | `HTML Content` |

The function only handles the `kebab-case → PascalCase` path. It does not split on camelCase boundaries, does not handle underscores, and produces wrong casing for acronyms.

Additionally, there is **no schema-level override** for display names. The JSON Schema `title` property is already available on every subschema but is not used as a display name source in most converters, only as a fallback for `description`.

---

## 2. Goals

| # | Goal | Measured by |
|---|------|-------------|
| G1 | Schema authors can explicitly control field ordering via a standard annotation | `x-cms-order` integer on any property-level subschema determines final UI field order |
| G2 | Ordering works seamlessly with schema layering | A `cms/` layer schema can add `x-cms-order` to override base field order without redefining properties |
| G3 | Storyblok converter emits correct `pos` values | Every field in output has a meaningful, deterministic `pos` |
| G4 | Display names are more accurate and overridable | `title` from schema takes precedence; `x-cms-label` available for explicit overrides; `toPascalCase` is improved as a fallback |

---

## 3. Non-Goals

- Inventing a custom ordering DSL — a simple integer is sufficient.
- Replacing the existing `x-cms-hidden`, `x-cms-preview`, or `x-cms-group-*` annotations.
- Changing how Storyblok's Management API consumes `pos` — we only control the generated JSON.
- Full i18n for display names — that's a localization concern handled by schema layering today (e.g. `resources/cms/language/` layers).
- Adjusting other CMS converters (StaticCMS, Stackbit, Hygraph, Uniform, CPort) — they will benefit from correct field ordering via the central reducer change, but converter-specific work is out of scope for this effort.

---

## 4. Design

### 4.1 The `x-cms-order` Annotation

A new custom JSON Schema keyword registered in `jsonschema-utils`:

```json
{
  "type": "object",
  "properties": {
    "headline": {
      "type": "string",
      "title": "Headline",
      "x-cms-order": 10
    },
    "subheadline": {
      "type": "string",
      "title": "Subheadline",
      "x-cms-order": 20
    },
    "image": {
      "type": "string",
      "format": "image",
      "x-cms-order": 30
    }
  }
}
```

**Rules:**

| Rule | Detail |
|------|--------|
| Type | Non-negative integer |
| Scope | Applied to individual properties inside a schema's `properties` object |
| Default | Fields without `x-cms-order` receive `Infinity` (sort last, preserve relative original order among unordered fields) |
| Conflicts | If two fields share the same `x-cms-order`, fall back to insertion order |
| Layering | A `cms/` layer can add or override `x-cms-order` on any property via `allOf` merge, just like `x-cms-hidden` today |
| Gaps | Encouraged (10, 20, 30) to allow future insertions without renumbering |
| Nesting | `x-cms-order` only controls sibling ordering within the same `properties` block, not cross-component ordering |

### 4.2 Integration Points

#### 4.2.1 `@kickstartds/jsonschema-utils`

1. **Register keyword** in `getSchemaRegistry()` alongside existing `x-cms-*` keywords:

   ```typescript
   ajv.addKeyword({
     keyword: 'x-cms-order',
     schemaType: 'number',
     validate: () => true
   });
   ```

2. **Expose a sort utility** for converters to use:

   ```typescript
   export function sortPropertiesByOrder(
     properties: Record<string, JSONSchema.Interface>
   ): [string, JSONSchema.Interface][] {
     return Object.entries(properties).sort(([, a], [, b]) => {
       const orderA = (a as any)['x-cms-order'] ?? Infinity;
       const orderB = (b as any)['x-cms-order'] ?? Infinity;
       return orderA - orderB;
     });
   }
   ```

3. **Integrate into `getSchemaReducer`** — the `buildComponent` and `buildType` functions currently iterate `Object.keys(schema.properties)`. Replace with `sortPropertiesByOrder(schema.properties)` so that **all converters automatically receive fields in the correct order**. This is the optimal integration point because it handles ordering once, centrally.

#### 4.2.2 `@kickstartds/jsonschema2storyblok`

Once fields arrive in order from the reducer, assign incrementing `pos`:

```typescript
// In each process function, or as a post-processing step
fields.forEach((field, index) => {
  field.pos = index;
});
```

Specific changes needed in `src/index.ts`:

| Location | Current | Proposed |
|----------|---------|----------|
| `processObject` (array parent, ~L251) | `pos: 0` | `pos` assigned by parent iteration index |
| `processObject` (object parent, ~L289) | `pos: 0` | same |
| `processObject` (tab creation, ~L309) | `pos: 0` | same |
| `processRef` (~L400) | `pos: 0` | same |
| `processRefArray` (~L450) | `pos: 0` | same |
| `processArray` (~L510) | `pos: 0` | same |
| `processEnum` (~L555) | `pos: 0` | same |
| `processBasic` (~L590) | `pos: 0` | same |
| `processConst` (~L580) | `pos: 0` | same |
| `getInternalTypeDefinition` (~L640) | `pos: 0` | same |

**Recommended approach:** Rather than assigning `pos` inside each process function (which doesn't know the field's position among siblings), apply `pos` in a post-processing step after `createBlokSchema()` builds the final schema record:

```typescript
function assignPositions(schema: Record<string, IStoryblokSchemaElement>): void {
  Object.values(schema).forEach((field, index) => {
    field.pos = index;
  });
}
```

Call this on each `blok.schema` after it is fully assembled.

#### 4.2.3 Other Converters (Out of Scope)

Since the ordering is applied centrally in the reducer, other converters will automatically receive fields in `x-cms-order` sequence without any converter-specific changes. Converter-specific adjustments (e.g. reworking StaticCMS's `sortFieldsDeep()`) are out of scope and can be addressed separately.

### 4.3 Display Name Improvements

#### 4.3.1 Use `title` as Primary Source

The JSON Schema `title` property is the natural place for a human-readable label. Change the display name resolution order to:

```
schema.title  →  toPascalCase(propertyKey)
```

This applies to all converters. The `title` is already available in the `IProcessInterface` as the `title` parameter — it just isn't used for display names in most converters today.

**Storyblok-specific change:**

```typescript
// Before
display_name: toPascalCase(name),

// After
display_name: title || toPascalCase(name),
```

The `title` parameter already flows through from the reducer — it's set to `objectSchema.title || name` in `buildType()` at `reduce.ts` line 164. Each process function receives it but ignores it for `display_name` today.

#### 4.3.2 Improve `toPascalCase` Fallback

Replace the current naive regex with a more robust implementation that handles:

- **camelCase splitting**: `backgroundColor` → `Background Color`
- **Underscore splitting**: `cta_link` → `Cta Link`
- **Acronym preservation** (optional, via a configurable list): `html` → `HTML`, `cta` → `CTA`, `faq` → `FAQ`

Proposed implementation in `jsonschema-utils/src/helpers.ts`:

```typescript
export function toPascalCase(text: string): string {
  return text
    // Insert space before uppercase letters in camelCase
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Replace hyphens and underscores with spaces
    .replace(/[-_]+/g, ' ')
    // Capitalize first letter of each word
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
```

This is a **breaking change** for existing outputs — every CMS that uses generated component names will see label changes. We accept this breakage: labels are display-only and don't affect stored data. Downstream projects can adjust labels via `x-cms-label` or schema `title` overrides through layering.

#### 4.3.3 Add `x-cms-label`

For cases where neither `title` nor `toPascalCase` produces the right label (e.g., `cta` should be `CTA`, or a field needs a completely custom name like `Call to Action`), a dedicated annotation allows explicit control:

```json
{
  "cta": {
    "type": "string",
    "title": "CTA",
    "x-cms-label": "Call to Action"
  }
}
```

Display name resolution order: **`x-cms-label → title → toPascalCase(key)`**

This is needed because `title` serves double duty — it's used for documentation/tooltip purposes in JSON Schema tooling and may not always match the desired editor label. `x-cms-label` provides an unambiguous, CMS-specific override.

**Implementation:**

1. Register `x-cms-label` as a custom keyword in `getSchemaRegistry()` (same pattern as other `x-cms-*` keywords)
2. Pass `x-cms-label` through the reducer alongside `title` in `IProcessInterface`
3. Update all Storyblok process functions to use the `x-cms-label → title → toPascalCase(key)` resolution chain
4. `x-cms-label` is layerable — a `cms/` layer can override labels without touching the base schema

---

## 5. Implementation Plan

### Phase 1: Core Infrastructure (jsonschema-utils)

1. Register `x-cms-order` and `x-cms-label` as custom keywords in `getSchemaRegistry()`
2. Add `sortPropertiesByOrder()` utility function
3. Modify `buildComponent()` and ref/object processing in `reduce.ts` to iterate properties using sorted order
4. Pass `x-cms-label` through `IProcessInterface` alongside existing `title`
5. Add unit tests verifying sort behavior (with order, without order, mixed, duplicate values)

### Phase 2: Storyblok Converter

1. Add `assignPositions()` post-processing to set `pos` from iteration index
2. Change `display_name` to use resolution chain: `x-cms-label → title → toPascalCase(name)`
3. Update existing example schemas in `examples/storyblok/` to include `x-cms-order` annotations
4. Regenerate `resources/config.json` fixture and verify correct `pos` values
5. Resolve TODO item at line 55 of `index.ts`

### Phase 3: Improved `toPascalCase`

1. Replace implementation with camelCase/underscore-aware version
2. Accept label breakage — labels are display-only and downstream projects adjust via `x-cms-label` or `title` layering
3. Update Storyblok example fixtures

---

## 6. Schema Layering Compatibility

`x-cms-order` integrates naturally with the existing layering system. A downstream CMS layer can override ordering without touching the base schema:

**Base schema** (`kickstartds` layer):
```json
{
  "$id": "http://schema.kickstartds.com/hero.schema.json",
  "properties": {
    "headline": { "type": "string" },
    "image": { "type": "string", "format": "image" },
    "cta": { "$ref": "button.schema.json" }
  }
}
```

**CMS layer** (`cms/` layer):
```json
{
  "$id": "http://cms.kickstartds.com/hero.schema.json",
  "allOf": [
    { "$ref": "http://schema.kickstartds.com/hero.schema.json" },
    {
      "properties": {
        "headline": { "x-cms-order": 10 },
        "cta": { "x-cms-order": 20 },
        "image": { "x-cms-order": 30 }
      }
    }
  ]
}
```

After `allOf` merging, the `hero` schema properties carry the `x-cms-order` values. The reducer sorts by them, and `image` moves to the end of the Storyblok editor form — even though it was second in the base schema.

This pattern is already proven for `x-cms-hidden` and `x-cms-preview`.

---

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Changing property iteration order in reducer breaks existing converter output | High | Medium | Phase implementation; run all example fixtures as regression tests before and after |
| `toPascalCase` change causes label churn in production CMS instances | Medium | Low | Accepted — labels are display-only and don't affect data; downstream projects adjust via `x-cms-label` or `title` layering |
| `x-cms-order` not preserved through `allOf` merge | Low | High | Validate explicitly — the `deepMerge` utility in `helpers.ts` already merges unknown properties through; add integration test |
| Converters that don't use `pos` (Stackbit, Hygraph) see no benefit | N/A | N/A | They still benefit from correct array ordering from the reducer |

---

## 8. Resolved Questions

1. **Should `x-cms-order` support fractional values (floats)?** No — integers with gaps (10, 20, 30) are simpler and sufficient. Renumbering is trivial in schema layers.
2. **Should ordering affect tab/section ordering in Storyblok?** Yes — tabs are treated as fields for ordering purposes. `x-cms-order` on a nested object schema controls its tab position relative to sibling fields and tabs.
3. **Per-converter order overrides?** No — use schema layering to provide CMS-specific overrides instead of multiplying annotations (e.g. no `x-storyblok-order`).
4. **Should `title` usage for display_name be opt-in?** No — it is the default. `title` is the semantically correct source; any issues are fixed by adjusting schema `title` values or using `x-cms-label`.

---

## 9. Success Criteria

- [ ] `x-cms-order` keyword registered and validated by AJV without errors
- [ ] Storyblok output has monotonically increasing `pos` values matching `x-cms-order` annotations
- [ ] Fields without `x-cms-order` appear after explicitly ordered fields, in original insertion order
- [ ] Schema layering can add/override `x-cms-order` on base schema properties
- [ ] `display_name` resolves as `x-cms-label → title → toPascalCase(key)`
- [ ] `x-cms-label` keyword registered, layerable, and used by Storyblok converter
- [ ] All existing Storyblok example fixtures regenerate cleanly
