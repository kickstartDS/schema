import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import { processSchemaGlob, getSchemaRegistry } from '@kickstartds/jsonschema-utils';
import {
  convert as convertToNetlifyCMS,
  createConfig as createConfigNetlifyCMS,
  INetlifyCmsConfig
} from '@kickstartds/jsonschema2netlifycms';
import { convert as convertToStoryblok } from '@kickstartds/jsonschema2storyblok';
import { resolve } from 'import-meta-resolve';
import { dump as yamlDump, load as yamlLoad } from 'js-yaml';

declare type MyAjv = import('ajv').default;

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/design-system/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  // get shared ajv instance, pre-process schemas and get full
  // set of unique schemas. precondition for the following conversions
  const ajv = getSchemaRegistry();
  await processSchemaGlob(customGlob, ajv);

  // generate `NetlifyCmsField` fields and write `NetlifyCmsConfig` to disk
  // uses custom `section.schema.json` to generate a section-based config
  generateNetlifyCMS(
    ['http://schema.kickstartds.com/page.schema.json'],
    ['http://kickstartds.com/cms/header.schema.json', 'http://kickstartds.com/cms/footer.schema.json'],
    ajv
  );

  generateStoryblok(['http://kickstartds.com/section.schema.json'], ajv);
})();

export function generateNetlifyCMS(
  schemaIds: string[],
  settingsSchemaIds: string[],
  ajv: MyAjv,
  configPath: string = `dist/config.yml`
): void {
  const configLocation = 'static/admin/config.yml';
  const config =
    configLocation &&
    existsSync(configLocation) &&
    (yamlLoad(readFileSync(configLocation, 'utf-8')) as INetlifyCmsConfig);

  const pageFields = convertToNetlifyCMS({
    schemaIds,
    ajv
  });

  const settingsFields = convertToNetlifyCMS({
    schemaIds: settingsSchemaIds,
    ajv
  });

  const netlifyConfig = createConfigNetlifyCMS(
    pageFields,
    settingsFields,
    config ? config : undefined,
    'pages',
    'settings'
  );

  const configDisclaimerNetlify =
    '# This file is auto-generated by @kickstartds/jsonschema2netlifycms\n# Don`t change manually, your changes *will* be lost!\n\n';
  const configStringNetlify = `${configDisclaimerNetlify}${yamlDump(netlifyConfig)}`;
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, configStringNetlify);
}

export function generateStoryblok(
  schemaIds: string[],
  // settingsSchemaIds: string[],
  ajv: MyAjv,
  configPath: string = `dist/components.123456.json`
): void {
  mkdirSync(path.dirname(configPath), { recursive: true });

  const pageFields = convertToStoryblok({
    schemaIds,
    ajv
  });

  // const settingsFields = convertToStoryblok({
  //   schemaIds,
  //   ajv
  // });

  const configStringStoryblok = JSON.stringify({ components: pageFields }, null, 2);
  writeFileSync(configPath, configStringStoryblok);
}

export { processSchemaGlob, getSchemaRegistry };
