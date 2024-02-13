import { mkdirSync, writeFileSync } from 'node:fs';
import { default as path } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  processSchemaGlob,
  getSchemaRegistry,
  getSchemaName,
  IClassifierResult
} from '@kickstartds/jsonschema-utils';
import { convert, configuration } from '@kickstartds/jsonschema2staticcms';
import { resolve } from 'import-meta-resolve';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        case 'settings':
        case 'blog-overview':
          return IClassifierResult.Global;
        case 'page':
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
        case 'header':
        case 'footer':
        case 'seo':
        case 'blog-teaser':
          return IClassifierResult.Component;
        default:
          return IClassifierResult.Object;
      }
    }
  });

  mkdirSync('dist/agency', { recursive: true });

  const configString = configuration(convertedObjects);
  writeFileSync('dist/agency/config.yml', configString);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await convertDsAgency();
})();
