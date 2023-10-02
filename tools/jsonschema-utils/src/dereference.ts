import $RefParser from '@bcherny/json-schema-ref-parser';
import { JSONSchema } from 'json-schema-typed/draft-07';

import { getSchemasForIds } from './helpers.js';

declare type MyAjv = import('ajv').default;

export async function dereference(schemaIds: string[], ajv: MyAjv): Promise<Record<string, JSONSchema>> {
  const parser = new $RefParser();
  const dereferencedSchemas: Record<string, JSONSchema> = {};
  const schemas = getSchemasForIds(schemaIds, ajv);

  for (const schema of schemas) {
    if (!schema.$id) throw new Error("Can't process a schema without $id");

    const dereferenced = await parser.dereference(schema as $RefParser.JSONSchema, {
      resolve: {
        ajv: {
          order: 1,
          canRead: new RegExp(`^http.*\.(?:schema|definitions)\.json$`),
          async read(file: $RefParser.FileInfo) {
            const schema = ajv.getSchema(file.url)?.schema;
            if (schema) return schema;
          }
        }
      }
    });

    dereferencedSchemas[schema.$id] = dereferenced as JSONSchema;
  }

  return dereferencedSchemas;
}
