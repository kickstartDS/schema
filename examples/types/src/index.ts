import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSchemaRegistry, processSchemaGlob } from '@kickstartds/jsonschema-utils';
import { createTypes } from '@kickstartds/jsonschema2types';
import { resolve } from 'import-meta-resolve';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/design-system/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions).json`;

  // get shared ajv instance, pre-process schemas and get full
  // set of unique schemas. precondition for the following conversions
  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv);

  await createTypes(
    schemaIds.filter((schemaId) => schemaId.includes('schema.kickstartds.com')),
    ajv
  );

  // await createTypes(getUniqueSchemaIds(schemaIds), ajv);
})();
