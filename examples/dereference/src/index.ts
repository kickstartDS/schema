import { mkdirSync, writeFileSync } from 'node:fs';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getCustomSchemaIds,
  getSchemaName,
  getSchemaRegistry,
  processSchemaGlob,
  dereference,
  IProcessingOptions
} from '@kickstartds/jsonschema-utils';
import { resolve } from 'import-meta-resolve';

const processingConfiguration: Partial<IProcessingOptions> = {
  typeResolution: false
};

async function convertDsAgency(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/ds-agency/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv, processingConfiguration);
  const customSchemaIds = getCustomSchemaIds(schemaIds);

  const dereferencedSchemas = await dereference(
    customSchemaIds.filter((schemaId) => !schemaId.includes('nav-main.schema.json')),
    ajv
  );

  mkdirSync('dist/agency', { recursive: true });

  for (const schemaId of Object.keys(dereferencedSchemas)) {
    writeFileSync(
      `dist/agency/${getSchemaName(schemaId)}.schema.json`,
      JSON.stringify(dereferencedSchemas[schemaId], null, 2)
    );
  }
}

async function convertKds(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/design-system/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv, processingConfiguration);
  const customSchemaIds = getCustomSchemaIds(schemaIds);

  const dereferencedSchemas = await dereference(customSchemaIds, ajv);

  mkdirSync('dist/kds', { recursive: true });

  for (const schemaId of Object.keys(dereferencedSchemas)) {
    writeFileSync(
      `dist/kds/${getSchemaName(schemaId)}.schema.json`,
      JSON.stringify(dereferencedSchemas[schemaId], null, 2)
    );
  }
}

async function convertCore(): Promise<void> {
  for (const module of ['base', 'blog', 'content', 'form']) {
    const packagePath = path.dirname(
      fileURLToPath(resolve(`@kickstartds/${module}/package.json`, import.meta.url))
    );
    const customGlob: string = `${packagePath}/lib/**/*.(schema|definitions|interface).json`;

    const ajv = getSchemaRegistry();
    const schemaIds = await processSchemaGlob(customGlob, ajv, processingConfiguration);
    const moduleSchemaIds = schemaIds.filter((schemaId) =>
      schemaId.startsWith(`http://schema.kickstartds.com/${module}/`)
    );

    const dereferencedSchemas = await dereference(moduleSchemaIds, ajv);

    mkdirSync(`dist/${module}`, { recursive: true });

    for (const schemaId of Object.keys(dereferencedSchemas)) {
      writeFileSync(
        `dist/${module}/${getSchemaName(schemaId)}.schema.json`,
        JSON.stringify(dereferencedSchemas[schemaId], null, 2)
      );
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await convertDsAgency();
  await convertKds();
  await convertCore();
})();
