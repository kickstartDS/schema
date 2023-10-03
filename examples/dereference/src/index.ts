import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getCustomSchemaIds,
  getSchemaName,
  getSchemaRegistry,
  processSchemaGlob,
  dereference
} from '@kickstartds/jsonschema-utils';
import { resolve } from 'import-meta-resolve';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/ds-agency/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv, false);
  const customSchemaIds = getCustomSchemaIds(schemaIds);

  const dereferencedSchemas = await dereference(customSchemaIds, ajv);

  mkdirSync('dist', { recursive: true });

  for (const schemaId of Object.keys(dereferencedSchemas)) {
    writeFileSync(
      `dist/${getSchemaName(schemaId)}.schema.json`,
      JSON.stringify(dereferencedSchemas[schemaId], null, 2)
    );
  }
})();
