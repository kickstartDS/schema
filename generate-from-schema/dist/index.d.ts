import Ajv from 'ajv/dist/core';
import { processSchemaGlob, getSchemaRegistry } from '@kickstartds/jsonschema-utils/dist/helpers';
export declare const generateGraphQL: (schemaIds: string[], ajv: Ajv, configPath?: string) => void;
export declare const generateNetlifyCMS: (schemaIds: string[], ajv: Ajv, configPath?: string) => void;
export { processSchemaGlob, getSchemaRegistry };
