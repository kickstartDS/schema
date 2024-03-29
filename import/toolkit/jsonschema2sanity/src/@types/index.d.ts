
import * as React from 'react';
import { ElementType, ReactNode } from 'react';
import { JSONSchema7 } from 'json-schema'
import Ajv from 'ajv/dist/core'

declare namespace jsonschema2sanity {
  export type GetSchema = (id: string) => JSONSchema7

  export interface ConvertParams {
    schemaIds: string[]
    ajv: Ajv
    schemaPost?: (schema: JSONSchema7) => JSONSchema7
  }

  export interface SanityConfigMap {
    config: DefaultConfigInterface,
    documents: Document<Record<string, any>>[],
    objects: ArrayOf[],
  }

  export interface DefaultConfigInterface {
    name: string,
    types: (Document<Record<string, any>>|Field)[],
  }

  // See https://github.com/sanity-io/sanity/issues/1857#issuecomment-905384304
  type Meta = {
    parent: { [key: string]: any };
    path: string[];
    document: { [key: string]: any };
  };

  type CustomRuleCallback = (field: any, meta: Meta) => true | string | Promise<true | string>;

  export type RuleType = {
    required: () => RuleType;
    custom: (cb: CustomRuleCallback) => RuleType;
    min: (min: number) => RuleType;
    max: (max: number) => RuleType;
    length: (exactLength: number) => RuleType;
    greaterThan: (gt: number) => RuleType;
    uri: (options: { scheme: string[] }) => RuleType;
    integer: () => RuleType;
    precision: (limit: number) => RuleType;
  };

  type Validation = (rule: RuleType) => RuleType | RuleType[];

  export type CommonFieldProps = {
    title?: string;
    fieldset?: string;
    group?: string;
    validation?: Validation;
    description?: string;
    hidden?: boolean;
    readOnly?: boolean;
    initialValue?: any;
    inputComponent?: ElementType;
  };

  export type StringField<Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'string';
    options?:
      | {
          list: { title: string; value: string }[] | string[];
          layout?: string;
        }
      | never;
  };

  export type NumberField<Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'number';
    options?: {
      list: { title: string; value: string }[] | string[];
    };
  };

  export type TextField<Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'text';
    rows?: number;
  };

  export type BooleanField<Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'boolean';
    options?: {
      layout?: 'switch' | 'checkbox';
    };
  };

  export type DateField<Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'date';
    options?: {
      dateFormat?: string;
    };
  };

  export type SlugField<Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'slug';
    options?: {
      source?: string;
    };
  };

  export type UrlField<Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'url';
  };

  export type BlockField<Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'block';
    styles?: Array<{
      title: string;
      value: string;
      blockEditor?: {
        render: ElementType;
      };
      icon?: ElementType;
    }>;
    lists?: Array<{
      title: string;
      value: string;
    }>;
    marks?: {
      annotations?: ArrayOf[];
      decorators?: Array<{
        title: string;
        value: string;
        icon?: ElementType;
      }>;
    };
    of?: ArrayOf[];
    icon?: ElementType;
  };

  type ArrayOf = ObjectField | ReferenceField | ImageField | { type: string } | BlockField;

  export type ArrayField<Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'array';
    of: ArrayOf[];
  };

  type FilterFunctionResult = { filter: string; filterParams?: string };
  type FilterFunction = (args: {
    document: { [key: string]: any };
    parentPath: string[];
    parent: Record<string, unknown>[];
  }) => FilterFunctionResult;

  type ReferenceField<Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'reference';
    to: { type: string }[];
    options?: {
      filter: string | FilterFunction;
      filterParams?: { [key: string]: string };
    };
  };

  type ImageField<Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'image';
    options?: {
      hotspot?: boolean;
    };
  };

  type FileField<Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'file';
  };

  export type CustomField<Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'money' | 'color' | 'icon' | 'iconPicker' | 'blockContent' | 'metadata' | 'code';
    options?: Record<string, any>;
  };

  export type FieldCollection<T extends string> = Array<Field<T>>;

  export type Field<Name extends string = string> =
    | StringField<Name>
    | NumberField<Name>
    | TextField<Name>
    | BooleanField<Name>
    | DateField<Name>
    | SlugField<Name>
    | UrlField<Name>
    | ArrayField<Name>
    | ReferenceField<Name>
    | ImageField<Name>
    | FileField<Name>
    | ObjectField<any, Name>
    | BlockField<Name>
    | CustomField<Name>;

  type Preview = {
    select?: { [key: string]: string };
    prepare?: (selection: {
      [key: string]: any;
    }) => {
      title?: ReactNode;
      subtitle?: ReactNode;
      media?: ReactNode;
    };
    component?: React.VFC;
  };

  type Fieldset = {
    name: string;
    title: string;
    options?: { collapsible: boolean; collapsed?: boolean; columns?: number };
  };

  type StringKeyof<T> = Extract<keyof T, string>;

  export type ObjectField<Schema extends any = any, Name extends string = string> = CommonFieldProps & {
    name: Name;
    type: 'object';
    title?: string;
    fields: FieldCollection<StringKeyof<Schema>>;
    validation?: Validation;
    preview?: Preview;
    fieldsets?: Fieldset[];
    description?: string;
    options?: { collapsible?: boolean; collapsed?: boolean };
  };

  export type Document<T extends Record<string, any>> = {
    type: 'document';
    name: string;
    icon?: ElementType;
    __experimental_actions?: string[];
    fields: FieldCollection<StringKeyof<T>>;
    title?: string;
    validation?: Validation;
    preview?: Preview;
    fieldsets?: Fieldset[];
    groups?: {
      name: string;
      title: string;
      default?: boolean;
      icon?: ElementType;
      hidden?: (options: {
        currentUser: unknown;
        value: unknown;
        parent: unknown;
      }) => boolean;
    }[],
    initialValue?: { [key: string]: any };
    orderings?: {
      name: string;
      title: string;
      by: { field: string; direction: string }[];
    }[];
  };

  export type PreviewProps<T extends Record<string, any>> = {
    value: T;
  };

  export type Body2TextProps = { children: React.FunctionComponent<any> };
}

export = jsonschema2sanity
