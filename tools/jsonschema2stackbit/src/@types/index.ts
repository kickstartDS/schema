declare module '@stackbit/types' {
  // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
  interface FieldCustomControlTypeProps<ControlType = never> {
    /**
     * TODO document
     */
    controlOptions?: [{ label: string; value: string }];
  }
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
