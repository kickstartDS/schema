import { mkdirSync, writeFileSync } from 'node:fs';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  processSchemaGlob,
  getSchemaRegistry,
  getCustomSchemaIds,
  getSchemaName,
  IClassifierResult
} from '@kickstartds/jsonschema-utils';
import { convert, configuration } from '@kickstartds/jsonschema2hygraph';
import { resolve } from 'import-meta-resolve';

export const schemaClassifier = (schemaId: string): IClassifierResult => {
  switch (getSchemaName(schemaId)) {
    case 'header':
    case 'footer':
    case 'seo':
      return IClassifierResult.Global;
    case 'page':
    case 'settings':
    case 'blog-overview':
    case 'blog-post':
      return IClassifierResult.Template;
    case 'cta':
    case 'faq':
    case 'features':
    case 'gallery':
    case 'image-text':
    case 'logos':
    case 'stats':
    case 'teaser-card':
    case 'testimonials':
    case 'text':
    case 'blog-teaser':
      return IClassifierResult.Component;
    default:
      return IClassifierResult.Object;
  }
};

async function convertDsAgency(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/ds-agency-premium/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv);
  const customSchemaIds = getCustomSchemaIds(schemaIds);

  const convertedObjects = convert({
    schemaIds: customSchemaIds.filter(
      (schemaId) => schemaClassifier(schemaId) === IClassifierResult.Component
    ),
    ajv,
    schemaClassifier
  });

  mkdirSync('dist/agency', { recursive: true });

  const configString = configuration(convertedObjects);
  writeFileSync('dist/agency/hygraph.json', configString);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function convertKds(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/design-system/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  const schemaIds = await processSchemaGlob(customGlob, ajv);
  const customSchemaIds = getCustomSchemaIds(schemaIds);

  mkdirSync('dist/kds', { recursive: true });

  const convertedObjects = convert({
    schemaIds: customSchemaIds,
    ajv
  });

  const configStringUniform = JSON.stringify({ components: convertedObjects }, null, 2);
  writeFileSync('dist/kds/hygraph.json', configStringUniform);
}

async function convertCore(): Promise<void> {
  for (const module of ['base', 'blog', 'form']) {
    const packagePath = path.dirname(
      fileURLToPath(resolve(`@kickstartds/${module}/package.json`, import.meta.url))
    );
    const customGlob = `${packagePath}/lib/**/*.(schema|definitions|interface).json`;

    const ajv = getSchemaRegistry();
    const schemaIds = await processSchemaGlob(customGlob, ajv);
    const moduleSchemaIds = schemaIds.filter((schemaId) =>
      schemaId.startsWith(`http://schema.kickstartds.com/${module}/`)
    );

    const convertedObjects = convert({
      schemaIds: moduleSchemaIds.filter((schemaId) => !schemaId.includes('table.schema.json')),
      ajv
    });

    mkdirSync(`dist/${module}`, { recursive: true });

    const configStringUniform = JSON.stringify({ components: convertedObjects }, null, 2);
    writeFileSync(`dist/${module}/hygraph.json`, configStringUniform);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await convertDsAgency();
  // await convertKds();
  await convertCore();
})();
