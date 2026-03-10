# Copilot Instructions — @kickstartDS/schema

## Project Overview

JSON Schema-to-CMS conversion toolkit for the [kickstartDS](https://www.kickstartds.com/) design system. Converts JSON Schema Draft-07 component definitions into configuration formats for headless CMS platforms (Storyblok, Stackbit, Hygraph, StaticCMS, Uniform, Payload CMS), TypeScript types, and an internal CPort format.

Single source of truth: one JSON Schema defines a component → converters produce CMS-specific output.

## Monorepo Structure

Rush.js + pnpm monorepo. All packages under `@kickstartds/` npm scope.

```
tools/                          # Core libraries (published)
  jsonschema-utils/             # Foundation — schema processing pipeline, AJV registry, reducer pattern
  cambria/                      # Bidirectional schema evolution / lens system
  jsonschema2storyblok/         # Storyblok converter
  jsonschema2stackbit/          # Stackbit converter
  jsonschema2hygraph/           # Hygraph converter
  jsonschema2staticcms/         # StaticCMS / Decap CMS converter
  jsonschema2uniform/           # Uniform converter
  jsonschema2cport/             # CPort (internal format) converter
  jsonschema2types/             # TypeScript .d.ts generator
examples/                       # Per-tool usage examples + fixtures
  storyblok/, stackbit/, ...    # CMS converter examples
  layering/                     # Schema layering demo
  dereference/                  # $ref dereferencing demo
  cambria/                      # Lens system demo
import/toolkit/                 # Legacy predecessor (reference only, do not modify)
docs/                           # Architecture docs, PRDs
```

## Key Architecture Concepts

### Schema Reducer Pattern
The central abstraction. Each CMS converter implements 8 process functions: `processObject`, `processRef`, `processRefArray`, `processObjectArray`, `processArray`, `processEnum`, `processConst`, `processBasic`. The `getSchemaReducer()` higher-order function (in `jsonschema-utils/src/reduce.ts`) walks a JSON Schema and dispatches to these, producing `IReducerResult<Component, Template, Global>`.

When writing a new converter or modifying an existing one, follow this pattern exactly. All process functions receive `IProcessInterface<Field>` and return `IProcessFnResult<Field, Component>`.

### Schema Layering
Schemas inherit across layers (e.g., `kickstartds` base → `agency` customization → `cms` overrides). Layers merge via `allOf`. Custom keywords like `x-cms-hidden`, `x-cms-preview`, `x-cms-order`, `x-cms-label` are added in CMS layers without modifying base schemas.

### Custom JSON Schema Keywords
Registered in `jsonschema-utils/src/helpers.ts` → `getSchemaRegistry()`:
- `x-cms-hidden` (boolean) — hide field in CMS editor
- `x-cms-preview` (string) — set preview field/template (`field:name` or `template:name`)
- `x-cms-group-*` (string/boolean) — field grouping (Stackbit)
- `x-cms-order` (number) — explicit field ordering
- `x-cms-label` (string) — explicit display name override

When adding a new `x-cms-*` keyword: register it in `getSchemaRegistry()`, then consume it in the relevant converter's process functions.

### Processing Pipeline
`processSchemas()` runs: layer resolution → dependency graph → topological sort → pre-processing → AJV registration → `allOf`/`anyOf` merging → reference inlining.

## Build & Development

```bash
# Install dependencies
node common/scripts/install-run-rush.js install

# Build all packages
node common/scripts/install-run-rush.js build

# Rebuild from clean
node common/scripts/install-run-rush.js rebuild --verbose

# Build a single package
cd tools/jsonschema2storyblok && node ../../common/scripts/install-run-rushx.js build

# Run tests
NODE_OPTIONS=--experimental-vm-modules npx heft test --clean
```

Rush commands (not raw pnpm) for install/build. Use `rushx` for per-package scripts.

## Code Style & Conventions

### TypeScript
- **Target**: ES2021, **module**: Node16, ESM (`"type": "module"`)
- **Imports**: Use `.js` extensions in import paths (ESM convention)
- **Config**: Extends `@rushstack/heft-node-rig/profiles/default/tsconfig-base.json`
- Declarations enabled, JSON module resolution enabled

### Formatting (Prettier)
- `printWidth: 110`, `singleQuote: true`, `trailingComma: none`, `endOfLine: auto`

### Linting (ESLint)
- Extends `@rushstack/eslint-config/profile/node-trusted-tool`
- Import order enforced: builtin → external → parent → sibling → index (alphabetized)
- Unused variables: prefix with `_` to suppress warnings

### Naming Conventions
- Interfaces: `I` prefix (`IStoryblokBlock`, `IProcessInterface`, `IReducerResult`)
- Type parameters: descriptive names (`Field`, `Component`, `Template`, `Global`)
- Schema element types: per-CMS naming (`IStoryblokSchemaElement`, `IStaticCmsField`)
- File naming: `kebab-case.ts`, type files in `@types/index.ts`
- Export pattern: named exports, re-exported from `index.ts`

### Converter Conventions
- Each converter has `src/index.ts` (main), `src/@types/index.ts` (types)
- `convert()` function is the public entry point
- `configuration()` serializes the result to the CMS-specific format (JSON/YAML)
- Type mapping defined as `ITypeMapping` (JSON Schema types → CMS field types)
- `toPascalCase()` from `jsonschema-utils` for display names (resolution: `x-cms-label → title → toPascalCase(key)`)
- Component deduplication via `componentsEqual()`

## Testing

- Jest via `@rushstack/heft-jest-plugin`
- Test files: `test/*.test.ts`
- Requires `NODE_OPTIONS=--experimental-vm-modules` for ESM
- Example packages serve as integration tests — their `resources/` directories contain fixture files (e.g., `config.json` for Storyblok)

## JSON Schema Specifics

- All schemas are **Draft-07** (`json-schema-typed/draft-07`)
- Schemas require `$id` — processing fails without one
- Composition keywords (`oneOf`, `anyOf`, `allOf`, `not`) are resolved during pre-processing; converters should never receive them
- Custom formats: `image`, `video`, `markdown`, `icon`, `id`, `table`, `date`
- The `type` property is used for interface resolution between schema variants (discriminated unions)

## Dependencies to Know

| Dependency | Purpose |
|-----------|---------|
| `ajv` | JSON Schema validation and registry |
| `json-schema-typed` | TypeScript types for JSON Schema Draft-07 |
| `directed-graph-typed` / `graphlib` | Schema dependency graph |
| `fast-json-patch` | RFC 6902 JSON Patch (used by cambria) |
| `uuid` (v4) | Unique IDs for Storyblok tabs/options |
| `json-schema-traverse` | Schema tree walking |

## Common Pitfalls

- Don't use `Object.keys(schema.properties)` for ordered iteration — use `sortPropertiesByOrder()` from `jsonschema-utils` to respect `x-cms-order`
- Schema `$ref`s are resolved during pre-processing; don't try to resolve them manually in converters
- The `type` field (configurable as `typeResolutionField`) is an internal discriminator — it gets a `const` value and should be hidden in CMS UIs
- `allOf` merging uses `deepMerge()` which preserves unknown properties — this is how `x-cms-*` keywords survive layering
- Legacy code in `import/toolkit/` is reference only — don't modify or depend on it
