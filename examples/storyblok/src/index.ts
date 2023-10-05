import { writeFileSync, mkdirSync } from 'node:fs';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import { processSchemaGlob, getSchemaRegistry, getCustomSchemaIds } from '@kickstartds/jsonschema-utils';
import { convert as convertToStoryblok } from '@kickstartds/jsonschema2storyblok';
import { resolve } from 'import-meta-resolve';

declare type MyAjv = import('ajv').default;

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
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

  // generateStoryblok(customSchemaIds, ajv);
})();

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

export { processSchemaGlob, getSchemaRegistry };
