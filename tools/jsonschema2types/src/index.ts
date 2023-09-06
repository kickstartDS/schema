import { writeFileSync, mkdirSync } from 'node:fs';

import $RefParser from '@bcherny/json-schema-ref-parser';
import { compile } from '@kickstartds/json-schema-to-typescript';
import { getSchemaName, getSchemasForIds } from '@kickstartds/jsonschema-utils';
import { JSONSchema4 } from 'json-schema';

declare type MyAjv = import('ajv').default;

export async function createTypes(schemaIds: string[], ajv: MyAjv): Promise<void> {
  const schemaDomain = 'kickstartds.com';
  const kdsResolver: $RefParser.ResolverOptions = {
    canRead: new RegExp(`^http:\/\/schema\.kickstartds\.com`, 'i'),
    async read(file: $RefParser.FileInfo) {
      return ajv.getSchema(file.url);
    }
  };

  const customResolver: $RefParser.ResolverOptions = {
    canRead: new RegExp(`^http:\/\/${schemaDomain.replaceAll('.', '.')}`, 'i'),
    async read(file: $RefParser.FileInfo) {
      return ajv.getSchema(file.url);
    }
  };

  const schemas = getSchemasForIds(schemaIds, ajv);

  mkdirSync('dist', { recursive: true });
  for (const schema of schemas) {
    writeFileSync(`dist/${getSchemaName(schema.$id)}.schema.json`, JSON.stringify(schema, null, 2));

    const typings = await compile(schema as JSONSchema4, getSchemaName(schema.$id), {
      declareExternallyReferenced: true,
      $refOptions: {
        resolve: {
          kds: {
            order: 1,
            ...kdsResolver
          },
          custom: {
            order: 2,
            ...customResolver
          }
        }
      }
    });

    writeFileSync(`dist/${getSchemaName(schema.$id)}.ts`, typings);
  }
}
