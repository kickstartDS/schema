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

// See https://www.marcveens.nl/netlify-cms-generate-config-yml
// https://www.netlifycms.org/docs/configuration-options/

type PublishMode = 'simple' | 'editorial_workflow';
type ExtensionType = 'yml' | 'yaml' | 'toml' | 'json' | 'md' | 'markdown' | 'html';
type FormatType =
  | 'yml'
  | 'yaml'
  | 'toml'
  | 'json'
  | 'frontmatter'
  | 'yaml-frontmatter'
  | 'toml-frontmatter'
  | 'json-frontmatter';
type WidgetType =
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'file'
  | 'hidden'
  | 'image'
  | 'list'
  | 'map'
  | 'markdown'
  | 'number'
  | 'object'
  | 'relation'
  | 'select'
  | 'string'
  | 'text'
  | string;
type MapType = 'Point' | 'LineString' | 'Polygon';
type MarkdownButtonType =
  | 'bold'
  | 'italic'
  | 'code'
  | 'link'
  | 'heading-one'
  | 'heading-two'
  | 'quote'
  | 'code-block'
  | 'bulleted-list'
  | 'numbered-list';
type ValueType = 'int' | 'float';

export interface INetlifyCmsField {
  name: string;
  label?: string;
  description?: string;
  widget: WidgetType;
  default?: string | string[] | number;
  collapsed?: boolean;
  required?: boolean;
  hint?: string;
  pattern?: string;

  // date | datetime
  format?: string;
  dateFormat?: boolean | string;
  timeFormat?: boolean | string;

  // file | image
  media_library?: {
    config: {
      multiple?: boolean;
    };
  };

  // list | object
  allow_add?: boolean;
  field?: INetlifyCmsField;
  fields?: INetlifyCmsField[]; // actually required in case of object
  types?: INetlifyCmsField[];

  // map
  type?: MapType;

  // markdown
  buttons?: MarkdownButtonType[];

  // number
  valueType?: ValueType | string;
  min?: number;
  max?: number;
  step?: number;

  // relation
  collection?: string;
  displayFields?: string[];
  searchFields?: string;
  valueField?: string;
  multiple?: boolean;

  // select
  options?: string[] | { label: string; value: string }[];
}

export interface INetlifyCmsFileCollection {
  name: string;
  file: string;
  label?: string;
  fields?: INetlifyCmsField[];
}

export interface INetlifyCmsCollection {
  name: string;
  identifier_field?: string;
  label?: string;
  label_singular?: string;
  description?: string;
  files?: INetlifyCmsFileCollection[];
  folder?: string;
  filter?: string;
  create?: boolean;
  delete?: boolean;
  extension?: ExtensionType;
  format?: FormatType;
  frontmatter_delimiter?: string | string[];
  slug?: string;
  preview_path?: string;
  fields?: INetlifyCmsField[];
  editor?: boolean;
  summary?: string;
}

export interface INetlifyCmsConfig {
  backend: {
    name: string;
    repo?: string;
    accept_roles?: string[];
    branch?: string;
    api_root?: string;
    site_domain?: string;
    base_url?: string;
    auth_endpoint?: string;
  };
  local_backend: boolean;

  publish_mode?: PublishMode;

  media_folder: string;
  public_folder?: string;
  media_library?: {
    name: string;
    config?: {
      publicKey?: string;
    };
  };

  site_url?: string;
  display_url?: string;
  logo_url?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  show_preview_links?: boolean;
  slug?: {
    encoding?: string;
    clean_accents?: boolean;
    sanitize_replacement?: string;
  };
  locale: string;

  collections: INetlifyCmsCollection[];
}
