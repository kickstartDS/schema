import { compile } from '@kickstartds/json-schema-to-typescript';
import { getSchemaName, getSchemasForIds } from '@kickstartds/jsonschema-utils';
import { JSONSchema4 } from 'json-schema';
import { pascalCase } from 'pascal-case';

declare type MyAjv = import('ajv').default;

export async function createTypes(
  schemaIds: string[],
  renderImportName: (schemaId: string) => string,
  renderImportStatement: (schemaId: string) => string,
  ajv: MyAjv
): Promise<Record<string, string>> {
  const generatedTypings: Record<string, string> = {};
  const schemas = getSchemasForIds(schemaIds, ajv);

  for (const schema of schemas) {
    if (!schema.$id) throw new Error("Can't process a schema without $id");

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
        },
        renderImportName,
        renderImportStatement
      }
    );

    generatedTypings[schema.$id] = typings;
  }

  return generatedTypings;
}
