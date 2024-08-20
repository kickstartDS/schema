import { mkdirSync, writeFileSync } from 'node:fs';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getCustomSchemaIds,
  getSchemaName,
  getSchemaRegistry,
  dereference,
  IProcessingOptions,
  processSchemaGlobs
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
  const additionalGlob = `resources/cms/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlobs([customGlob, additionalGlob], ajv, processingConfiguration);
  const customSchemaIds = getCustomSchemaIds(schemaIds);

  // TODO check back if can remove the filter on `nav-main.schema.json`
  const dereferencedSchemas = await dereference(customSchemaIds, ajv);

  mkdirSync('dist/agency', { recursive: true });

  for (const schemaId of Object.keys(dereferencedSchemas)) {
    writeFileSync(
      `dist/agency/${getSchemaName(schemaId)}.schema.json`,
      JSON.stringify(dereferencedSchemas[schemaId], null, 2)
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await convertDsAgency();
})();
