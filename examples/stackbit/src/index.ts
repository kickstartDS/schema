import { mkdirSync, writeFileSync } from 'node:fs';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  processSchemaGlob,
  getSchemaRegistry,
  getCustomSchemaIds,
  IClassifierResult,
  getSchemaName
} from '@kickstartds/jsonschema-utils';
import { convert as convertToStackbit } from '@kickstartds/jsonschema2stackbit';
import { resolve } from 'import-meta-resolve';

async function convertDsAgency(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/ds-agency/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv);
  const customSchemaIds = getCustomSchemaIds(schemaIds);

  const { components, templates, globals } = convertToStackbit({
    schemaIds: customSchemaIds,
    ajv,
    schemaClassifier: (schemaId: string) => {
      switch (getSchemaName(schemaId)) {
        case 'header':
        case 'footer':
          return IClassifierResult.Global;
        case 'page':
          return IClassifierResult.Template;
        default:
          return IClassifierResult.Component;
      }
    }
  });

  mkdirSync('dist/agency', { recursive: true });

  const configStringStackbit = JSON.stringify(
    { components: [...components, ...templates, ...globals] },
    null,
    2
  );
  writeFileSync(`dist/agency/models.json`, configStringStackbit);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function convertKds(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/design-system/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv);
  const customSchemaIds = getCustomSchemaIds(schemaIds);

  const { components } = convertToStackbit({
    schemaIds: customSchemaIds,
    ajv
  });

  mkdirSync('dist/kds', { recursive: true });

  const configStringStackbit = JSON.stringify({ components }, null, 2);
  writeFileSync(`dist/kds/models.json`, configStringStackbit);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function convertCore(): Promise<void> {
  for (const module of ['base', 'blog', 'content', 'form']) {
    const packagePath = path.dirname(
      fileURLToPath(resolve(`@kickstartds/${module}/package.json`, import.meta.url))
    );
    const customGlob = `${packagePath}/lib/**/*.(schema|definitions|interface).json`;

    const ajv = getSchemaRegistry();
    const schemaIds = await processSchemaGlob(customGlob, ajv);
    const moduleSchemaIds = schemaIds.filter((schemaId) =>
      schemaId.startsWith(`http://schema.kickstartds.com/${module}/`)
    );

    const { components } = convertToStackbit({
      schemaIds: moduleSchemaIds.filter((schemaId) => !schemaId.includes('table.schema.json')),
      ajv
    });

    mkdirSync(`dist/${module}`, { recursive: true });

    const configStringStackbit = JSON.stringify({ components }, null, 2);
    writeFileSync(`dist/${module}/models.json`, configStringStackbit);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await convertDsAgency();
  // await convertKds();
  // await convertCore();
})();
