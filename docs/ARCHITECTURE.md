# kickstartDS Schema Tooling — Architecture

## What It Does

This is a **JSON Schema-to-CMS conversion toolkit** for the [kickstartDS](https://www.kickstartds.com/) design system. It takes JSON Schema definitions describing UI components (buttons, headlines, sections, etc.) and automatically converts them into the configuration formats required by **various headless CMS platforms**, GraphQL schemas, and TypeScript types — enabling a **single source of truth** for component definitions across an entire content infrastructure.

---

## Monorepo Structure

The project is managed with **Rush.js** + **pnpm** and organized into **20 packages** across 3 categories:

| Category | Location | Count |
|----------|----------|-------|
| Core tools | `tools/` | 10 |
| Examples | `examples/` | 10 |
| Legacy (imported) | `import/toolkit/` | 7+ |

All packages are published under the `@kickstartds/` npm scope.

---

## Core Architecture

### 1. Foundation Layer

#### `@kickstartds/jsonschema-utils` — Schema Processing Pipeline

The central utility library that **all converter tools depend on**. It provides:

- **Schema Registry**: An AJV-based registry with custom formats (`image`, `video`, `markdown`, etc.) and custom keywords (`allOf-merge`, `inline-group`, `cms-hide`, etc.)
- **Processing Pipeline** (`processSchemas`): A 5-step pipeline — layer resolution → graph construction → pre-processing → AJV registration → composition resolution (`allOf` merging, `anyOf` enum merging)
- **Layering System**: Schema inheritance across multiple "layers" (e.g., `kickstartds` base → `agency` customization → `cms` overrides) allowing downstream design systems to override base component schemas
- **Dependency Graph**: Builds a directed graph of schema dependencies based on `$ref` relationships, with topological sorting for processing order
- **Schema Reducer Pattern** (`getSchemaReducer`): The **core abstraction** — a higher-order function that takes CMS-specific process functions (one per JSON Schema type pattern) and returns a reducer that walks a schema and produces CMS-specific output

#### `@kickstartds/cambria` — Schema Evolution / Lens System

A **bidirectional data migration engine** inspired by [Ink & Switch Cambria](https://www.inkandswitch.com/cambria/). It provides:

- **10 Lens Operations**: `add`, `remove`, `rename`, `hoist`, `plunge`, `wrap`, `head`, `in`, `map`, and scoped variants
- **Schema Updates**: Apply lenses to transform JSON Schemas
- **Patch Translation**: Translate JSON Patch operations through lenses, enabling data migration without touching documents directly
- **Reversibility**: Every lens is invertible (`add` ↔ `remove`, `wrap` ↔ `head`)
- **Lens Graphs**: Directed graph of schema versions, with Dijkstra-based path finding for multi-version migration

---

### 2. CMS Converter Tools

All converters follow an **identical architectural pattern**: they implement the process function interface from `jsonschema-utils` by providing CMS-specific implementations of 8 process functions (`processObject`, `processRef`, `processRefArray`, `processObjectArray`, `processArray`, `processEnum`, `processConst`, `processBasic`).

| Package | Target Platform | Output Format |
|---------|----------------|---------------|
| `jsonschema2stackbit` | Stackbit | `ObjectModel` / `DataModel` / `PageModel` |
| `jsonschema2storyblok` | Storyblok | Component definitions with nested blocks |
| `jsonschema2hygraph` | Hygraph | Management SDK field types |
| `jsonschema2staticcms` | Static CMS / Decap CMS | Widget-based YAML configs |
| `jsonschema2uniform` | Uniform | Component parameters and slots |
| `jsonschema2cport` | CPort (internal format) | Normalized fields |
| `jsonschema2payloadcms` | Payload CMS | Payload field configs |
| `jsonschema2types` | TypeScript | `.d.ts` type definitions |

---

### 3. Example Packages

Each example demonstrates a specific capability:

| Example | Demonstrates |
|---------|-------------|
| `cambria-example` | Loading YAML lens files and applying schema evolution |
| `dereference-example` | Full `$ref` dereferencing into standalone schemas |
| `layering-example` | Schema layering/inheritance across packages |
| CMS examples (stackbit, storyblok, etc.) | Each converter tool's usage |

---

### 4. Legacy Import (`import/toolkit/`)

The **predecessor project**, kept for reference. Contains earlier converters for GraphQL, Sanity, TinaCMS, Builder.io, and Gatsby tooling.

---

## Key Patterns & Abstractions

### Schema Reducer Pattern

The central design pattern. Each CMS converter provides typed implementations of ~8 process functions. The reducer walks JSON Schema types recursively and dispatches to the appropriate function, returning a unified `IReducerResult<Component, Template, Global>`.

### Custom Schema Keywords

Schemas use kickstartDS-specific keywords for CMS metadata: `allOf-merge`, `inline-group`, `cms-hide`, `preview-template`, enabling CMS-specific behavior without polluting standard JSON Schema.

### Schema Layering

A sophisticated inheritance system where schemas from different "layers" can extend each other using `$ref` with JSON Pointer paths, with layer priority defined by a configurable array.

---

## Data Flow

```
kickstartDS Component Schemas (JSON Schema Draft-07)
        │
        ▼
  processSchemas()  ←  jsonschema-utils pipeline
    ├── Layer resolution
    ├── Dependency graph + topological sort
    ├── allOf/anyOf merging & reference inlining
    └── AJV registration
        │
        ▼
  getSchemaReducer()  ←  per-target CMS converter
    ├── processObject / processRef / processArray / ...
    └── basicTypeMapping / buildDescription / ...
        │
        ▼
  IReducerResult<Component, Template, Global>
        │
        ▼
  configuration()  →  JSON / YAML / TypeScript output for target CMS
```

---

## Renderer-Side Lens Consumption

When a CMS converter applies **key-mutating annotations** (currently
`x-cms-group-inline` — see [PRD-storyblok-grouping-and-inline.md](PRD-storyblok-grouping-and-inline.md)),
the resulting CMS field layout no longer matches the original JSON Schema. To
bridge this gap on the renderer side, `@kickstartds/jsonschema-utils` emits a
**Cambria lens** alongside the CMS config that describes the forward transform
from the un-annotated schema to the CMS shape. The renderer reverses this lens
and applies it to incoming CMS payloads to recover the original component
shape — exactly what its TypeScript types expect.

### Build-time: emitting lenses

A typical CMS-example build (see [examples/storyblok/src/index.ts](../examples/storyblok/src/index.ts))
walks the registered schemas, calls `generateLens(schema)`, and writes a YAML
sibling per component that contains key-mutating annotations:

```ts
import { dumpYamlLens } from '@kickstartds/cambria';
import { generateLens, getSchemaForId, getSchemaName } from '@kickstartds/jsonschema-utils';

const seen = new Set<string>();
for (const schemaId of allSchemaIds) {
  const name = getSchemaName(schemaId);
  if (!name || seen.has(name)) continue;
  const schema = getSchemaForId(schemaId, ajv);
  const lens = generateLens(schema);
  if (lens.length === 0) continue;
  seen.add(name);
  writeFileSync(`dist/lenses/${name}.lens.yml`, dumpYamlLens(lens));
}
```

A component with no key-mutating annotations produces an empty lens and no
file — the consumer treats "no lens file" as identity.

### Forward lens shape (`x-cms-group-inline`)

For a wrapper `image` with children `src`, `alt`, `srcMobile`, the generator
emits:

```yaml
lens:
  - hoist:    { host: image, name: src }
  - rename:   { source: src, destination: image__src }
  - hoist:    { host: image, name: alt }
  - rename:   { source: alt, destination: image__alt }
  - hoist:    { host: image, name: srcMobile }
  - rename:   { source: srcMobile, destination: image__srcMobile }
  - remove:   { name: image, type: object }
```

Every op is invertible. `reverseLens()` inverts them in reverse order, so
applying the reverse lens to a CMS payload reconstructs the original nested
shape.

### Runtime: a Next.js + Storyblok consumer

Reference setup: [kickstartDS/ruhmesmeile-storyblok-starter — packages/website](https://github.com/kickstartDS/ruhmesmeile-storyblok-starter/tree/main/packages/website).
That project already implements story processing in
`helpers/storyblok.ts` (asset URL rewrites, link resolution, empty-image
cleanup, number coercion, etc.) and historically used a hand-written
`unflatten()` helper to undo CMS-side key flattening. Replacing
`unflatten()` with the generated lens is the intended migration target.

**Minimal integration pattern**:

```ts
// helpers/lenses.ts
import { applyLensToDoc, loadYamlLens, reverseLens, LensSource } from '@kickstartds/cambria';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Build a name -> reverse lens map once at module load.
const LENS_DIR = path.join(process.cwd(), 'cms/lenses');

const reverseLenses: Record<string, LensSource> = Object.fromEntries(
  readdirSync(LENS_DIR)
    .filter((f) => f.endsWith('.lens.yml'))
    .map((f) => {
      const name = f.replace(/\.lens\.yml$/, '');
      const forward = loadYamlLens(readFileSync(path.join(LENS_DIR, f), 'utf8'));
      return [name, reverseLens(forward)];
    })
);

/**
 * Apply the reverse lens registered for `component` (if any) to `blok`.
 * Returns the original (un-flattened) shape that the React component expects.
 * If no lens is registered, returns `blok` unchanged.
 */
export function unflattenBlok<T extends { component: string }>(blok: T): T {
  const lens = reverseLenses[blok.component];
  if (!lens) return blok;
  return applyLensToDoc(lens, blok) as T;
}
```

**Wiring into the existing `storyProcessing()` traversal** (the starter walks
the story tree with `object-traversal`'s `traverse()`):

```ts
import { traverse, TraversalCallbackContext } from 'object-traversal';
import { unflattenBlok } from '@/helpers/lenses';

export function storyProcessing(blok: Record<string, any>, preview = false) {
  // ...existing fixups (links, assets, etc.)...

  function applyLenses({ parent, key, value }: TraversalCallbackContext) {
    if (parent && key && value && typeof value === 'object' && typeof value.component === 'string') {
      parent[key] = unflattenBlok(value);
    }
  }

  traverse(blok, (context) => {
    // Run lens un-flattening first so subsequent callbacks see the
    // nested shape that matches the React component prop types.
    applyLenses(context);
    removeEmptyImages(context);
    mapStoryblokLinks(context);
    mapStoryblokAssets(context);
    // ...etc
  });

  return blok;
}
```

### What lenses do — and don't — replace

- **Replace**: structural key-mutating transforms (`image__src` → `image.src`),
  array-of-objects flattening (via `map` ops the generator emits for arrays),
  and any future annotation-driven shape changes.
- **Do not replace**: asset URL rewriting, link/relation resolution, empty-image
  cleanup, type coercion (`"3"` → `3`). These remain imperative concerns of the
  story processor — they depend on the CMS's runtime payload conventions, not
  on the schema shape.

### Operational notes

- **Bundling**: lenses are static YAML; ship them with the renderer (e.g.
  copy `dist/lenses/` into `cms/lenses/` in the website package, or import via
  a small webpack/Next.js asset rule).
- **Versioning**: the generator is deterministic; commit the emitted YAML so
  diffs surface in PRs when annotations change. CI can re-emit and assert
  no-diff.
- **Performance**: `applyLensToDoc` is O(ops × keys). For Storyblok payloads
  (hundreds of bloks per page, tens of ops per component) the cost is
  negligible compared to the network round-trip. Build the `reverseLenses`
  map once at module load — don't reverse on every render.
- **Failure mode**: a missing lens means identity, never a thrown error.
  Renderers degrade gracefully for components without annotations.

---

## Technology Stack

| Category | Technologies |
|----------|-------------|
| Language | TypeScript 5.0+ (ESM modules) |
| Build | Rush.js + Heft (`@rushstack/heft-node-rig`) |
| Package Manager | pnpm 7.32.2 |
| Runtime | Node.js ≥ 18.16 |
| JSON Schema | Draft-07, validated with AJV |
| Graph Algorithms | `directed-graph-typed`, `graphlib` |
| Patch Operations | `fast-json-patch` (RFC 6902) |
| Testing | Jest (via `@rushstack/heft-jest-plugin`) |
