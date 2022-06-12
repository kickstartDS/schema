# v2.2.0 (Sun Jun 12 2022)

#### 🚀 Enhancement

- feature: add conversion for Builder.io [#36](https://github.com/kickstartDS/kickstartDS-schema-toolkit/pull/36) ([@julrich](https://github.com/julrich) [@lmestel](https://github.com/lmestel))
- refactor: extract common functionality [#37](https://github.com/kickstartDS/kickstartDS-schema-toolkit/pull/37) ([@julrich](https://github.com/julrich) [@lmestel](https://github.com/lmestel))
- feature: add draft for sanity schema generation [#29](https://github.com/kickstartDS/kickstartDS-schema-toolkit/pull/29) ([@julrich](https://github.com/julrich) [@lmestel](https://github.com/lmestel))

#### 🐛 Bug Fix

- fix: re-add page schema to netlify cms ([@julrich](https://github.com/julrich))
- Merge branch 'feature/shared-api-for-transformers' into feature/add-sanity-schema-support ([@julrich](https://github.com/julrich))
- fix: don't actually dedupe type field ([@julrich](https://github.com/julrich))
- Merge branch 'feature/shared-api-for-transformers' of github.com:kickstartDS/kickstartDS-schema-toolkit into feature/shared-api-for-transformers ([@julrich](https://github.com/julrich))
- build: add missing deps to package.json ([@lmestel](https://github.com/lmestel))
- refactor: extract deduping from GraphQL schemaReducer ([@julrich](https://github.com/julrich))
- feature: add createConfig to graphql converter ([@julrich](https://github.com/julrich))
- fix: align reducers some more, extract helpers ([@julrich](https://github.com/julrich))
- fix: input of GraphQL generation, works again now ([@julrich](https://github.com/julrich))
- feature: finish up pre-processing ([@julrich](https://github.com/julrich))
- refactor: clean up handling of type interfaces ([@julrich](https://github.com/julrich))
- refactor: start reworking converter input mechanism ([@julrich](https://github.com/julrich))
- refactor: start reworking definitions, ref layering ([@julrich](https://github.com/julrich))
- fix: don't layer definitions for now ([@julrich](https://github.com/julrich))
- chore: refactor schema loading ([@julrich](https://github.com/julrich))
- fix: update dependencies, fix netlify cms reducer ([@julrich](https://github.com/julrich))
- feature: extract common functionality ([@julrich](https://github.com/julrich))

#### Authors: 2

- Jonas Ulrich ([@julrich](https://github.com/julrich))
- Lukas Mestel ([@lmestel](https://github.com/lmestel))

---

# v2.1.1 (Wed Apr 13 2022)

#### ⚠️ Pushed to `master`

- Merge branch 'master' of github.com:kickstartDS/kickstartDS-schema-toolkit ([@julrich](https://github.com/julrich))

#### 🔩 Dependency Updates

- chore(deps): bump minimist from 1.2.5 to 1.2.6 [#34](https://github.com/kickstartDS/kickstartDS-schema-toolkit/pull/34) ([@dependabot[bot]](https://github.com/dependabot[bot]))

#### Authors: 2

- [@dependabot[bot]](https://github.com/dependabot[bot])
- Jonas Ulrich ([@julrich](https://github.com/julrich))

---

# v2.1.0 (Wed Apr 13 2022)

#### 🚀 Enhancement

- feature: add helper for enum merging [#35](https://github.com/kickstartDS/kickstartDS-schema-toolkit/pull/35) ([@julrich](https://github.com/julrich))

#### 🐛 Bug Fix

- feature: correctly pre-merge anyOfs for enums ([@julrich](https://github.com/julrich))
- feature: add helper for enum merging ([@julrich](https://github.com/julrich))

#### Authors: 1

- Jonas Ulrich ([@julrich](https://github.com/julrich))

---

# v2.0.0 (Wed Apr 13 2022)

#### 💥 Breaking Change

- Add `Tina CMS` as a conversion target for our `JSON Schema` [#33](https://github.com/kickstartDS/kickstartDS-schema-toolkit/pull/33) ([@julrich](https://github.com/julrich))

#### 🐛 Bug Fix

- fix: add html format ([@julrich](https://github.com/julrich))
- fix: ajv instance per getSchemas run ([@julrich](https://github.com/julrich))
- fix: de-duplicate getSchemaName and move to exported helpers ([@julrich](https://github.com/julrich))
- feature: refactor helpers into their own module ([@julrich](https://github.com/julrich))

#### Authors: 1

- Jonas Ulrich ([@julrich](https://github.com/julrich))
