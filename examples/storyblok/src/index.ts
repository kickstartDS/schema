import { writeFileSync, mkdirSync } from 'node:fs';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import { processSchemaGlob, getSchemaRegistry, getCustomSchemaIds } from '@kickstartds/jsonschema-utils';
import { convert as convertToStoryblok } from '@kickstartds/jsonschema2storyblok';
import { resolve } from 'import-meta-resolve';

declare type MyAjv = import('ajv').default;

async function convertDsAgency(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/ds-agency/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  // get shared ajv instance, pre-process schemas and get full
  // set of unique schemas. precondition for the following conversions
  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv);
  const customSchemaIds = getCustomSchemaIds(schemaIds);

  generateStoryblok(
    customSchemaIds.filter((schemaId) => !schemaId.includes('nav-main.schema.json')),
    ajv
  );
}

async function convertKds(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/design-system/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  // get shared ajv instance, pre-process schemas and get full
  // set of unique schemas. precondition for the following conversions
  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv);
  const customSchemaIds = getCustomSchemaIds(schemaIds);

  mkdirSync('dist/kds', { recursive: true });

  generateStoryblok(
    customSchemaIds.filter((schemaId) => !schemaId.includes('nav-main.schema.json')),
    ajv,
    `dist/kds/components.123456.json`
  );
}

async function convertCore(): Promise<void> {
  for (const module of ['base', 'blog', 'content', 'core', 'form']) {
    const packagePath = path.dirname(
      fileURLToPath(resolve(`@kickstartds/${module}/package.json`, import.meta.url))
    );
    const customGlob = `${packagePath}/lib/**/*.(schema|definitions|interface).json`;

    // get shared ajv instance, pre-process schemas and get full
    // set of unique schemas. precondition for the following conversions
    const ajv = getSchemaRegistry();
    const schemaIds = await processSchemaGlob(customGlob, ajv);
    const moduleSchemaIds = schemaIds.filter((schemaId) =>
      schemaId.startsWith(`http://schema.kickstartds.com/${module}/`)
    );

    mkdirSync(`dist/${module}`, { recursive: true });

    generateStoryblok(
      moduleSchemaIds.filter((schemaId) => !schemaId.includes('nav-main.schema.json')),
      ajv,
      `dist/${module}/components.123456.json`
    );
  }
}

export function generateStoryblok(
  schemaIds: string[],
  ajv: MyAjv,
  configPath: string = `dist/components.123456.json`
): void {
  mkdirSync(path.dirname(configPath), { recursive: true });

  const pageFields = convertToStoryblok({
    schemaIds,
    ajv
  });

  const configStringStoryblok = JSON.stringify({ components: pageFields }, null, 2);
  writeFileSync(configPath, configStringStoryblok);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await convertDsAgency();
  await convertKds();
  await convertCore();
})();
