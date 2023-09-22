import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getCustomSchemaIds,
  getSchemaRegistry,
  getUniqueSchemaIds,
  processSchemaGlob,
  shouldLayer
} from '@kickstartds/jsonschema-utils';
import { createTypes } from '@kickstartds/jsonschema2types';
import { resolve } from 'import-meta-resolve';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/ds-agency/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions).json`;

  // get shared ajv instance, pre-process schemas and get full
  // set of unique schemas. precondition for the following conversions
  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv, false);
  const kdsSchemaIds = schemaIds.filter((schemaId) => schemaId.includes('schema.kickstartds.com'));

  const customSchemaIds = getCustomSchemaIds(schemaIds);
  const unlayeredSchemaIds = getUniqueSchemaIds(schemaIds).filter(
    (schemaId) => !customSchemaIds.includes(schemaId)
  );
  const layeredSchemaIds = customSchemaIds.filter((schemaId) =>
    kdsSchemaIds.some((kdsSchemaId) => shouldLayer(schemaId, kdsSchemaId))
  );

  await createTypes([...unlayeredSchemaIds, ...layeredSchemaIds], kdsSchemaIds, ajv);
})();
