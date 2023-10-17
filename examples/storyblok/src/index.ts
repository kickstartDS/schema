import { writeFileSync, mkdirSync } from 'node:fs';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import { processSchemaGlob, getSchemaRegistry, getCustomSchemaIds } from '@kickstartds/jsonschema-utils';
import { convert as convertToStoryblok } from '@kickstartds/jsonschema2storyblok';
import { resolve } from 'import-meta-resolve';

async function convertDsAgency(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/ds-agency/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv);
  const customSchemaIds = getCustomSchemaIds(schemaIds);

  mkdirSync('dist/agency', { recursive: true });

  const pageFields = convertToStoryblok({
    schemaIds: customSchemaIds.filter((schemaId) => !schemaId.includes('nav-main.schema.json')),
    ajv
  });

  const configStringStoryblok = JSON.stringify({ components: pageFields }, null, 2);
  writeFileSync(`dist/agency/components.123456.json`, configStringStoryblok);
}

async function convertKds(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/design-system/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv);
  const customSchemaIds = getCustomSchemaIds(schemaIds);

  mkdirSync('dist/kds', { recursive: true });

  const pageFields = convertToStoryblok({
    schemaIds: customSchemaIds,
    ajv
  });

  const configStringStoryblok = JSON.stringify({ components: pageFields }, null, 2);
  writeFileSync(`dist/kds/components.123456.json`, configStringStoryblok);
}

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

    mkdirSync(`dist/${module}`, { recursive: true });

    const pageFields = convertToStoryblok({
      schemaIds: moduleSchemaIds.filter((schemaId) => !schemaId.includes('table.schema.json')),
      ajv
    });

    const configStringStoryblok = JSON.stringify({ components: pageFields }, null, 2);
    writeFileSync(`dist/${module}/components.123456.json`, configStringStoryblok);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await convertDsAgency();
  await convertKds();
  await convertCore();
})();
