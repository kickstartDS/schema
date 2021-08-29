import { JSONSchema7 } from 'json-schema'
import Ajv from 'ajv/dist/core'

declare namespace jsonschema2netlifycms {
  export interface ConvertParams {
    jsonSchema: JSONSchema7 | JSONSchema7[] | string | string[]
    definitions: JSONSchema7[]
    ajv: Ajv
    configLocation?: string
  }

  // See https://www.marcveens.nl/netlify-cms-generate-config-yml
  // https://www.netlifycms.org/docs/configuration-options/

  type PublishMode = 'simple' | 'editorial_workflow'
  type ExtensionType = 'yml' | 'yaml' | 'toml' | 'json' | 'md' | 'markdown' | 'html'
  type FormatType =
    | 'yml'
    | 'yaml'
    | 'toml'
    | 'json'
    | 'frontmatter'
    | 'yaml-frontmatter'
    | 'toml-frontmatter'
    | 'json-frontmatter'
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
    | string
  type MapType = 'Point' | 'LineString' | 'Polygon'
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
    | 'numbered-list'
  type ValueType = 'int' | 'float'

  export type NetlifyCmsField = {
    name: string
    label?: string
    description?: string
    widget: WidgetType
    default?: string | string[] | number
    collapsed?: boolean
    required?: boolean
    hint?: string
    pattern?: string

    // date | datetime
    format?: string
    dateFormat?: boolean | string
    timeFormat?: boolean | string

    // file | image
    media_library?: {
      config: {
        multiple?: boolean
      }
    }

    // list | object
    allow_add?: boolean
    field?: NetlifyCmsField
    fields?: NetlifyCmsField[] // actually required in case of object
    types?: NetlifyCmsField[]

    // map
    type?: MapType

    // markdown
    buttons?: MarkdownButtonType[]

    // number
    valueType?: ValueType | string
    min?: number
    max?: number
    step?: number

    // relation
    collection?: string
    displayFields?: string[]
    searchFields?: string
    valueField?: string
    multiple?: boolean

    // select
    options?: string[] | { label: string; value: string }[]
  }

  export type NetlifyCmsCollection = {
    name: string
    identifier_field?: string
    label?: string
    label_singular?: string
    description?: string
    files?: string
    folder?: string
    filter?: string
    create?: boolean
    delete?: boolean
    extension?: ExtensionType
    format?: FormatType
    frontmatter_delimiter?: string | string[]
    slug?: string
    preview_path?: string
    fields: NetlifyCmsField[]
    editor?: boolean
    summary?: string
  }

  export type NetlifyCmsConfig = {
    backend: {
      name: string
      repo?: string
      accept_roles?: string[]
      branch?: string
      api_root?: string
      site_domain?: string
      base_url?: string
      auth_endpoint?: string
    }
    local_backend: boolean

    publish_mode?: PublishMode

    media_folder: string
    public_folder?: string
    media_library?: {
      name: string
      config?: {
        publicKey?: string
      }
    }

    site_url?: string
    display_url?: string
    logo_url?: string
    show_preview_links?: boolean
    slug?: {
      encoding?: string
      clean_accents?: boolean
      sanitize_replacement?: string
    }
    locale: string

    collections: NetlifyCmsCollection[]
  }
}

export = jsonschema2netlifycms
