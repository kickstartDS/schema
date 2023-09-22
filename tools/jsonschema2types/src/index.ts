import { writeFileSync, mkdirSync } from 'node:fs';

// import $RefParser from '@bcherny/json-schema-ref-parser';
import { compile } from '@kickstartds/json-schema-to-typescript';
import {
  getSchemaName,
  getSchemaModule,
  getSchemasForIds,
  isLayering,
  layeredSchemaId
} from '@kickstartds/jsonschema-utils';
import { JSONSchema4 } from 'json-schema';
import { pascalCase } from 'pascal-case';

declare type MyAjv = import('ajv').default;

export async function createTypes(schemaIds: string[], kdsSchemaIds: string[], ajv: MyAjv): Promise<void> {
  // const schemaDomain = 'kickstartds.com';
  // const kdsResolver: $RefParser.ResolverOptions = {
  //   canRead: new RegExp(`^http:\/\/schema\.kickstartds\.com`, 'i'),
  //   async read(file: $RefParser.FileInfo) {
  //     return ajv.getSchema(file.url);
  //   }
  // };

  // const customResolver: $RefParser.ResolverOptions = {
  //   canRead: new RegExp(`^http:\/\/${schemaDomain.replaceAll('.', '.')}`, 'i'),
  //   async read(file: $RefParser.FileInfo) {
  //     return ajv.getSchema(file.url);
  //   }
  // };

  const schemas = getSchemasForIds(schemaIds, ajv);

  mkdirSync('dist', { recursive: true });
  for (const schema of schemas) {
    if (!schema.$id) throw new Error("Can't process a schema without $id");
    // writeFileSync(`dist/${getSchemaName(schema.$id)}.schema.json`, JSON.stringify(schema, null, 2));

    const typings = await compile(
      {
        ...(schema as JSONSchema4),
        title: `${schema.title}Props`
      },
      `${pascalCase(getSchemaName(schema.$id))}Props`,
      {
        declareExternallyReferenced: true,
        $refOptions: {
          resolve: {
            external: false
          }
        }
      }
    );

    const layeredId = isLayering(schema.$id, kdsSchemaIds)
      ? layeredSchemaId(schema.$id, kdsSchemaIds)
      : schema.$id;

    // console.log(layeredId, schema.$id, isLayering(schema.$id, kdsSchemaIds));

    writeFileSync(
      `dist/${pascalCase(getSchemaName(layeredId))}Props.ts`,
      `declare module "@kickstartds/${getSchemaModule(layeredId)}/lib/${getSchemaName(layeredId)}/typing" {
${typings}
}
    `
    );
  }
}
