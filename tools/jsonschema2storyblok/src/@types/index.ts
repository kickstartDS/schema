/* eslint-disable @typescript-eslint/naming-convention */
import { type JSONSchema } from 'json-schema-typed/draft-07';

declare type MyAjv = import('ajv').default;

export interface IConvertParams {
  schemaIds: string[];
  ajv: MyAjv;
  schemaPost?: (schema: JSONSchema.Interface) => JSONSchema.Interface;
}

export type GenericType =
  | 'text'
  | 'bloks'
  | 'array'
  | 'option'
  | 'options'
  | 'number'
  | 'image'
  | 'boolean'
  | 'textarea'
  | 'markdown'
  | 'richtext'
  | 'datetime'
  | 'asset'
  | 'multiasset'
  | 'multilink'
  | 'table';

export type StoryblokElement = IStoryblokBlock | IStoryblokSchemaElement;

export interface IStoryblokBlock {
  name: string;
  display_name: string;
  created_at: string;
  updated_at: string;
  id: number;
  schema: Record<string, IStoryblokSchemaElement>;
  image?: unknown;
  preview_field?: unknown;
  is_root?: boolean;
  preview_tmpl?: string;
  is_nestable: boolean;
  all_presets?: unknown[];
  preset_id?: unknown;
  real_name: string;
  component_group_uuid?: unknown;
  component_group_name?: string;
  color?: unknown;
  icon?: unknown;
}

export interface IStoryblokSchemaElement {
  type: GenericType;
  pos?: number;
  key: string;
  use_uuid?: boolean;
  source?: 'internal' | 'external' | 'internal_stories' | 'internal_languages';
  options?: IStoryblokSchemaElementOption[];
  filter_content_type?: string[];
  restrict_components?: boolean;
  component_whitelist?: string[];
  component_group_whitelist?: string[];
  restrict_type?: 'groups' | '';
  exclude_empty_option?: boolean;
  max_length?: string;
  required?: boolean;
  display_name: string;
  default_value?: string;
  description?: string;
  fields?: IStoryblokSchemaElement[];
  objectFields?: IStoryblokSchemaElement[];
  objectArrayFields?: IStoryblokSchemaElement[];
  arrayFields?: IStoryblokSchemaElement[];
  bloks?: StoryblokElement[];
}

export interface IStoryblokSchemaElementOption {
  _uid?: string;
  name: string;
  value: string;
}

export interface ITypeMapping {
  boolean: GenericType;
  string: GenericType;
  integer: GenericType;
  array: GenericType;
  object: GenericType;
  null: GenericType;
  number: GenericType;
}
