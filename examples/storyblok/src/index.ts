import { mkdirSync, writeFileSync } from 'node:fs';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  processSchemaGlob,
  getSchemaRegistry,
  getCustomSchemaIds,
  IClassifierResult,
  getSchemaName
} from '@kickstartds/jsonschema-utils';
import { convert, configuration } from '@kickstartds/jsonschema2storyblok';
import { resolve } from 'import-meta-resolve';

async function convertDsAgency(): Promise<void> {
  const packagePath = path.dirname(
    fileURLToPath(resolve(`@kickstartds/ds-agency/package.json`, import.meta.url))
  );
  const customGlob = `${packagePath}/(dist|cms)/**/*.(schema|definitions|interface).json`;

  const ajv = getSchemaRegistry();
  await processSchemaGlob(customGlob, ajv);

  const convertedObjects = convert({
    schemaIds: [
      'http://schema.mydesignsystem.com/cms/page.schema.json',
      'http://schema.mydesignsystem.com/cms/settings.schema.json',
      'http://schema.mydesignsystem.com/cms/blog-overview.schema.json',
      'http://schema.mydesignsystem.com/cms/blog-post.schema.json'
    ],
    ajv,
    schemaClassifier: (schemaId: string) => {
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
    }
  });

  mkdirSync('dist/agency', { recursive: true });

  const configString = configuration(convertedObjects);
  writeFileSync(`dist/agency/components.123456.json`, configString);
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

  const convertedObjects = convert({
    schemaIds: customSchemaIds,
    ajv
  });

  mkdirSync('dist/kds', { recursive: true });

  const configString = configuration(convertedObjects);
  writeFileSync(`dist/kds/components.123456.json`, configString);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    const configString = configuration(convertedObjects);
    writeFileSync(`dist/${module}/components.123456.json`, configString);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await convertDsAgency();
  // await convertKds();
  await convertCore();
})();
