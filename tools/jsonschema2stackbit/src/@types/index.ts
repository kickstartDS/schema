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
