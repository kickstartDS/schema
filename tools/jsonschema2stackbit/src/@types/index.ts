/* eslint-disable @typescript-eslint/naming-convention */
import { type JSONSchema } from 'json-schema-typed/draft-07';

declare type MyAjv = import('ajv').default;

export interface IConvertParams {
  schemaIds: string[];
  ajv: MyAjv;
  schemaPost?: (schema: JSONSchema.Interface) => JSONSchema.Interface;
}

export type GenericType =
  | 'boolean'
  | 'color'
  | 'date'
  | 'datetime'
  | 'enum'
  | 'image'
  | 'list'
  | 'markdown'
  | 'model'
  | 'number'
  | 'object'
  | 'reference'
  | 'slug'
  | 'string'
  | 'style'
  | 'text';

export interface ITypeMapping {
  boolean: GenericType;
  string: GenericType;
  integer: GenericType;
  array: GenericType;
  object: GenericType;
  null: GenericType;
  number: GenericType;
}
