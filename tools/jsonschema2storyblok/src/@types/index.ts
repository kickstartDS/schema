/* eslint-disable @typescript-eslint/naming-convention */
// Storyblok types stem from here: https://github.com/dohomi/storyblok-generate-ts/blob/master/src/typings.ts
// Related Storyblok docs:
// - https://www.storyblok.com/docs/api/management#core-resources/components/components
// - https://www.storyblok.com/docs/schema-configuration
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
  | 'table'
  | 'tab';

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
  component_group_name?: string; // undocumented
  color?: string; // undocumented
  icon?: string; // undocumented
}

export interface IStoryblokSchemaElement {
  id: number;
  type: GenericType;
  pos: number;
  key: string; // undocumented
  keys?: string[];
  use_uuid?: boolean;
  source?: 'internal' | 'external' | 'internal_stories' | 'internal_languages';
  options?: IStoryblokSchemaElementOption[];
  filter_content_type?: string[]; // sus
  restrict_components?: boolean;
  component_whitelist?: string[];
  component_group_whitelist?: string[]; // undocumented
  restrict_type?: 'groups' | ''; // sus
  exclude_empty_option?: boolean; // sus
  max_length?: string;
  required?: boolean;
  display_name: string;
  default_value?: string;
  description?: string;

  objectFields?: IStoryblokSchemaElement[];
}

export interface IStoryblokSchemaElementOption {
  _uid: string;
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
