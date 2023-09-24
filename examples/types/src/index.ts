import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getCustomSchemaIds,
  getSchemaModule,
  getSchemaName,
  getSchemaRegistry,
  getUniqueSchemaIds,
  isLayering,
  layeredSchemaId,
  processSchemaGlob,
  shouldLayer
} from '@kickstartds/jsonschema-utils';
import { createTypes } from '@kickstartds/jsonschema2types';
import { resolve } from 'import-meta-resolve';
import { type JSONSchema } from 'json-schema-typed/draft-07';
import { pascalCase } from 'pascal-case';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/ds-agency/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions).json`;

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

  const layeredTypes = await createTypes([...unlayeredSchemaIds, ...layeredSchemaIds], ajv);

  mkdirSync('dist', { recursive: true });

  for (const schemaId of Object.keys(layeredTypes)) {
    const schema = ajv.getSchema(schemaId)?.schema as JSONSchema.Interface;

    if (!schema) throw new Error("Can't find schema for layered type");
    if (!schema.$id) throw new Error('Found schema without $id property');

    const layeredId = isLayering(schema.$id, kdsSchemaIds)
      ? layeredSchemaId(schema.$id, kdsSchemaIds)
      : schema.$id;

    writeFileSync(
      `dist/${pascalCase(getSchemaName(layeredId))}Props.ts`,
      `declare module "@kickstartds/${getSchemaModule(layeredId)}/lib/${getSchemaName(layeredId)}/typing" {
${layeredTypes[schemaId]}
}
        `
    );
  }
})();
