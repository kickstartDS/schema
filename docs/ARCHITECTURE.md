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
