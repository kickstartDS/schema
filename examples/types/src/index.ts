import { mkdirSync, writeFileSync } from 'node:fs';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  IProcessingOptions,
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

const renderImportName = (schemaId: string): string => {
  return `${pascalCase(getSchemaName(schemaId))}Props`;
};

const renderImportStatement = (schemaId: string): string => {
  return `import type { ${pascalCase(getSchemaName(schemaId))}Props } from '@kickstartds/${getSchemaModule(
    schemaId
  )}/lib/${getSchemaName(schemaId)}/typing'`;
};

const processingConfiguration: Partial<IProcessingOptions> = {
  typeResolution: false,
  mergeAllOf: false
};

async function convertDsAgency(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/ds-agency/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv, processingConfiguration);
  const kdsSchemaIds = schemaIds.filter((schemaId) => schemaId.includes('schema.kickstartds.com'));

  const customSchemaIds = getCustomSchemaIds(schemaIds);
  const unlayeredSchemaIds = getUniqueSchemaIds(schemaIds).filter(
    (schemaId) => !customSchemaIds.includes(schemaId)
  );
  const layeredSchemaIds = customSchemaIds.filter((schemaId) =>
    kdsSchemaIds.some((kdsSchemaId) => shouldLayer(schemaId, kdsSchemaId))
  );

  const layeredTypes = await createTypes(
    [...unlayeredSchemaIds, ...layeredSchemaIds],
    renderImportName,
    renderImportStatement,
    ajv,
    {
      bannerComment:
        '/* eslint-disable */\n/**\n* This file was automatically generated by json-schema-to-typescript.\n* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,\n* and run `yarn run schema` to regenerate this file.\n*/',
      style: { singleQuote: true, printWidth: 80 }
    }
  );

  mkdirSync('dist/agency', { recursive: true });

  for (const schemaId of Object.keys(layeredTypes)) {
    const schema = ajv.getSchema(schemaId)?.schema as JSONSchema.Interface;

    if (!schema) throw new Error("Can't find schema for layered type");
    if (!schema.$id) throw new Error('Found schema without $id property');

    const layeredId = isLayering(schema.$id, kdsSchemaIds)
      ? layeredSchemaId(schema.$id, kdsSchemaIds)
      : schema.$id;

    writeFileSync(
      `dist/agency/${pascalCase(getSchemaName(layeredId))}Props.ts`,
      `declare module "@kickstartds/${getSchemaModule(layeredId)}/lib/${getSchemaName(layeredId)}/typing" {
${layeredTypes[schemaId]}
}
        `
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function convertKds(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/design-system/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv, processingConfiguration);
  const kdsSchemaIds = schemaIds.filter((schemaId) => schemaId.includes('schema.kickstartds.com'));

  const customSchemaIds = getCustomSchemaIds(schemaIds);
  const unlayeredSchemaIds = getUniqueSchemaIds(schemaIds).filter(
    (schemaId) => !customSchemaIds.includes(schemaId)
  );
  const layeredSchemaIds = customSchemaIds.filter((schemaId) =>
    kdsSchemaIds.some((kdsSchemaId) => shouldLayer(schemaId, kdsSchemaId))
  );

  const layeredTypes = await createTypes(
    [...unlayeredSchemaIds, ...layeredSchemaIds],
    renderImportName,
    renderImportStatement,
    ajv,
    {
      bannerComment:
        '/* eslint-disable */\n/**\n* This file was automatically generated by json-schema-to-typescript.\n* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,\n* and run `yarn run schema` to regenerate this file.\n*/',
      style: { singleQuote: true, printWidth: 80 }
    }
  );

  mkdirSync('dist/kds', { recursive: true });

  for (const schemaId of Object.keys(layeredTypes)) {
    const schema = ajv.getSchema(schemaId)?.schema as JSONSchema.Interface;

    if (!schema) throw new Error("Can't find schema for layered type");
    if (!schema.$id) throw new Error('Found schema without $id property');

    const layeredId = isLayering(schema.$id, kdsSchemaIds)
      ? layeredSchemaId(schema.$id, kdsSchemaIds)
      : schema.$id;

    writeFileSync(
      `dist/kds/${pascalCase(getSchemaName(layeredId))}Props.ts`,
      `declare module "@kickstartds/${getSchemaModule(layeredId)}/lib/${getSchemaName(layeredId)}/typing" {
${layeredTypes[schemaId]}
}
        `
    );
  }
}

async function convertCore(): Promise<void> {
  for (const module of ['base', 'blog', 'form']) {
    const packagePath = path.dirname(
      fileURLToPath(resolve(`@kickstartds/ds-agency/package.json`, import.meta.url))
    );
    const customGlob = `${packagePath}/lib/**/*.(schema|definitions|interface).json`;

    const ajv = getSchemaRegistry();
    const schemaIds = await processSchemaGlob(customGlob, ajv, processingConfiguration);
    const kdsSchemaIds = schemaIds.filter((schemaId) => schemaId.includes('schema.kickstartds.com'));

    const customSchemaIds = getCustomSchemaIds(schemaIds);
    const unlayeredSchemaIds = getUniqueSchemaIds(schemaIds).filter(
      (schemaId) => !customSchemaIds.includes(schemaId)
    );
    const layeredSchemaIds = customSchemaIds.filter((schemaId) =>
      kdsSchemaIds.some((kdsSchemaId) => shouldLayer(schemaId, kdsSchemaId))
    );

    const layeredTypes = await createTypes(
      [...unlayeredSchemaIds, ...layeredSchemaIds].filter((schemaId) =>
        schemaId.startsWith(`http://schema.kickstartds.com/${module}/`)
      ),
      renderImportName,
      renderImportStatement,
      ajv,
      {
        bannerComment:
          '/* eslint-disable */\n/**\n* This file was automatically generated by json-schema-to-typescript.\n* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,\n* and run `yarn run schema` to regenerate this file.\n*/',
        style: { singleQuote: true, printWidth: 80 }
      }
    );

    mkdirSync(`dist/${module}`, { recursive: true });

    for (const schemaId of Object.keys(layeredTypes)) {
      const schema = ajv.getSchema(schemaId)?.schema as JSONSchema.Interface;

      if (!schema) throw new Error("Can't find schema for layered type");
      if (!schema.$id) throw new Error('Found schema without $id property');

      const layeredId = isLayering(schema.$id, kdsSchemaIds)
        ? layeredSchemaId(schema.$id, kdsSchemaIds)
        : schema.$id;

      writeFileSync(
        `dist/${module}/${pascalCase(getSchemaName(layeredId))}Props.ts`,
        `declare module "@kickstartds/${getSchemaModule(layeredId)}/lib/${getSchemaName(layeredId)}/typing" {
  ${layeredTypes[schemaId]}
  }
          `
      );
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await convertDsAgency();
  // await convertKds();
  await convertCore();
})();
