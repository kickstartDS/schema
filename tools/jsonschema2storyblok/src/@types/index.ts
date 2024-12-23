/* eslint-disable @typescript-eslint/naming-convention */
// Storyblok types stem from here: https://github.com/dohomi/storyblok-generate-ts/blob/master/src/typings.ts
// Related Storyblok docs:
// - https://www.storyblok.com/docs/api/management#core-resources/components/components
// - https://www.storyblok.com/docs/api/management/core-resources/components/the-component-schema-field-object
// - https://www.storyblok.com/docs/schema-configuration

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
  | 'tab'
  | 'custom';

export type AssetType = 'images' | 'videos';

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
  restrict_type?: 'groups' | ''; // undocumented
  exclude_empty_option?: boolean; // sus
  max_length?: string;
  required?: boolean;
  display_name: string;
  default_value?: string;
  description?: string;
  minimum?: number;
  maximum?: number;

  // type: `asset` / `multiasset`
  filetypes?: AssetType[];
  asset_folder_id?: number;

  // type: `multilink`
  allow_target_blank?: boolean;
  email_link_type?: boolean;
  asset_link_type?: boolean;
  show_anchor?: boolean;
  restrict_content_types?: boolean;

  // type: `date`
  disable_time?: boolean;

  // type: `custom`
  field_type?: string;

  // our own processing helpers
  objectFields?: IStoryblokSchemaElement[];
  preview_tmpl?: string;
  preview_field?: string;
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
