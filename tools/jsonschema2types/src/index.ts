import { compile, Options } from '@kickstartds/json-schema-to-typescript';
import { getSchemaName, getSchemasForIds } from '@kickstartds/jsonschema-utils';
import { JSONSchema4 } from 'json-schema';
import { pascalCase } from 'pascal-case';

declare type MyAjv = import('ajv').default;

export function defaultTitleFunction(schema: JSONSchema4): string {
  return `${schema.title}Props`;
}

export function defaultFilenameFunction(schema: JSONSchema4): string {
  return `${pascalCase(getSchemaName(schema.$id))}Props`;
}

export async function createTypes(
  schemaIds: string[],
  renderImportName: (schemaId: string) => string,
  renderImportStatement: (schemaId: string) => string,
  ajv: MyAjv,
  options?: Partial<Options>,
  titleFunction: (schema: JSONSchema4) => string = defaultTitleFunction,
  filenameFunction: (schema: JSONSchema4) => string = defaultFilenameFunction
): Promise<Record<string, string>> {
  const generatedTypings: Record<string, string> = {};
  const schemas = getSchemasForIds(schemaIds, ajv);

  for (const schema of schemas as JSONSchema4[]) {
    if (!schema.$id) throw new Error("Can't process a schema without $id");

    const typings = await compile(
      {
        ...schema,
        title: titleFunction(schema)
      },
      filenameFunction(schema),
      {
        declareExternallyReferenced: true,
        $refOptions: {
          resolve: {
            external: false
          }
        },
        renderImportName,
        renderImportStatement,
        ...options
      }
    );

    generatedTypings[schema.$id] = typings;
  }

  return generatedTypings;
}
