import { mkdirSync, writeFileSync } from 'node:fs';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import { processSchemaGlob, getSchemaRegistry } from '@kickstartds/jsonschema-utils';
import {
  convert as convertToNetlifyCMS,
  createConfig as createConfigNetlifyCMS
} from '@kickstartds/jsonschema2netlifycms';
import { resolve } from 'import-meta-resolve';
import { dump as yamlDump } from 'js-yaml';

async function convertKds(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/design-system/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  await processSchemaGlob(customGlob, ajv);

  const pageFields = convertToNetlifyCMS({
    schemaIds: ['http://schema.kickstartds.com/page.schema.json'],
    ajv
  });

  const settingsFields = convertToNetlifyCMS({
    schemaIds: [
      'http://kickstartds.com/cms/header.schema.json',
      'http://kickstartds.com/cms/footer.schema.json'
    ],
    ajv
  });

  const netlifyConfig = createConfigNetlifyCMS(
    pageFields.components,
    settingsFields.components,
    undefined,
    'pages',
    'settings'
  );

  mkdirSync('dist/kds', { recursive: true });

  const configDisclaimerNetlify =
    '# This file is auto-generated by @kickstartds/jsonschema2netlifycms\n# Don`t change manually, your changes *will* be lost!\n\n';
  const configStringNetlify = `${configDisclaimerNetlify}${yamlDump(netlifyConfig)}`;
  writeFileSync('dist/kds/config.yml', configStringNetlify);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await convertKds();
})();
