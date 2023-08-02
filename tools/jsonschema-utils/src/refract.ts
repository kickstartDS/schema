import { promises } from 'fs';

import { loadYamlLens, updateSchema } from '@kickstartds/cambria';
import { type JSONSchema } from 'json-schema-typed/draft-07';

declare type MyAjv = import('ajv').default;

export async function refract(schemaId: string, lensPath: string, ajv: MyAjv): Promise<JSONSchema.Interface> {
  const schema = ajv.getSchema(schemaId)?.schema as JSONSchema.Interface;

  if (!schema) throw new Error('Tried to refract a schema that was not found in ajv');

  const lensData = await promises.readFile(lensPath, 'utf-8');
  const lens = loadYamlLens(lensData);
  const updatedSchema = updateSchema(schema, lens);

  // ajv.removeSchema(schema.$id);
  // ajv.addSchema(updatedSchema);

  return updatedSchema;
}
