// @ts-nocheck
/**
 * see: https://github.com/sanity-io/sanity/issues/1857#issuecomment-1079799475
 */

type MaybeArray<T> = T | T[];
type MaybePromise<T> = T | Promise<T>;

/** @link https://www.sanity.io/docs/validation */
interface Rule<ExtendingRule, Value> {
  custom: (
    validator: (value: Value, context: unknown) => MaybePromise<false | string>
  ) => ExtendingRule;
  error: (message: string) => ExtendingRule;
  required: () => ExtendingRule;
  valueOfField: (field: string) => unknown;
  warning: (message: string) => ExtendingRule;
}

interface LengthRule<ExtendingRule> {
  length: (exactLength: number) => ExtendingRule;
}

interface MinMaxRule<ExtendingRule> {
  max: (maxValue: number) => ExtendingRule;
  min: (minLength: number) => ExtendingRule;
}

interface StringContentRule<ExtendingRule> {
  lowercase: () => ExtendingRule;
  regex: (
    regex: RegExp,
    options?: {
      invert?: boolean;
      name?: string;
    }
  ) => ExtendingRule;
  uppercase: () => ExtendingRule;
}

interface ListItem<Value> {
  title: string;
  value: Value;
}

type ListItems<Value> = Value[] | ListItem<Value>[];

type ListOptions<Value> =
  | {
      layout?: "dropdown";
      list?: ListItems<Value>;
    }
  | {
      direction?: "horizontal" | "vertical";
      layout: "radio";
      list?: ListItems<Value>;
    };

interface NamedDef<Name extends string> {
  name: Name;
  title?: string;
}

/** @link https://www.sanity.io/docs/initial-value-templates */
interface WithInitialValue<Value> {
  initialValue?: Value | (() => Promise<Value>);
}

/** @link https://www.sanity.io/docs/conditional-fields */
type ConditionalField<Value> =
  | boolean
  | ((context: {
      currentUser: {
        email: string;
        id: string;
        name: string;
        profileImage: string;
        roles: {
          description?: string;
          name: string;
          title?: string;
        }[];
      };
      document?: unknown;
      parent?: unknown;
      value: Value;
    }) => boolean);

/** @link https://www.sanity.io/docs/schema-types */
interface FieldDef<Name extends string, Rule, Value>
  extends NamedDef<Name>,
    WithInitialValue<Value> {
  /** @link https://github.com/ricokahler/sanity-codegen/tree/alpha#schema-codegen-options */
  codegen?: { required: boolean };
  description?: string;
  hidden?: ConditionalField<Value>;
  readonly?: ConditionalField<Value>;
  /** @link https://www.sanity.io/docs/validation */
  validation?: (rule: Rule) => MaybeArray<Rule>;
}

/** @link https://www.sanity.io/docs/block-type#validation */
interface BlockRule extends Rule<BlockRule, unknown> {}

/** @link https://www.sanity.io/docs/block-type */
interface BlockFieldDef<Name extends string>
  extends FieldDef<Name, BlockRule, unknown> {
  icon?: (...args: unknown[]) => unknown;
  lists?: ListItem<unknown>[];
  marks?: unknown;
  of?: unknown[];
  options?: { spellCheck?: boolean };
  styles?: ListItem<unknown>[];
}

/** @link https://www.sanity.io/docs/boolean-type#validation */
interface BooleanRule extends Rule<BooleanRule, boolean> {}

/** @link https://www.sanity.io/docs/boolean-type */
interface BooleanFieldDef<Name extends string>
  extends FieldDef<Name, BooleanRule, boolean> {
  options?: { layout?: "checkbox" | "switch" };
  type: "boolean";
}

/** @link https://www.sanity.io/docs/date-type#validation */
interface DateRule extends Rule<DateRule, string> {}

/** @link https://www.sanity.io/docs/date-type */
interface DateFieldDef<Name extends string>
  extends FieldDef<Name, DateRule, string> {
  options?: {
    calendarTodayLabel?: string;
    dateFormat?: string;
  };
}

/** @link https://www.sanity.io/docs/datetime-type#validation */
interface DatetimeRule
  extends Rule<DatetimeRule, string>,
    MinMaxRule<DatetimeRule> {}

/** @link https://www.sanity.io/docs/datetime-type */
interface DatetimeFieldDef<Name extends string>
  extends FieldDef<Name, DatetimeRule, string> {
  options?: {
    calendarTodayLabel?: string;
    dateFormat?: string;
    timeFormat?: string;
    timeStep?: number;
  };
}

interface GeopointValue {
  alt: number;
  lat: number;
  lng: number;
}

/** @link https://www.sanity.io/docs/geopoint-type#validation */
interface GeopointRule extends Rule<GeopointRule, GeopointValue> {}

/** @link https://www.sanity.io/docs/geopoint-type */
interface GeopointFieldDef<Name extends string>
  extends FieldDef<Name, GeopointRule, GeopointValue> {
  options?: {
    calendarTodayLabel?: string;
    dateFormat?: string;
    timeFormat?: string;
    timeStep?: number;
  };
}

/** @link https://www.sanity.io/docs/number-type#validation */
interface NumberRule extends Rule<NumberRule, number>, MinMaxRule<NumberRule> {
  greaterThan: (limit: number) => NumberRule;
  integer: () => NumberRule;
  lessThan: (limit: number) => NumberRule;
  negative: () => NumberRule;
  positive: () => NumberRule;
  precision: (limit: number) => NumberRule;
}

/** @link https://www.sanity.io/docs/number-type */
interface NumberFieldDef<Name extends string>
  extends FieldDef<Name, NumberRule, number> {
  options?: ListOptions<number>;
  type: "number";
}

interface ReferenceValue {
  _ref: string;
  _type: "reference";
}

/** @link https://www.sanity.io/docs/reference-type#validation */
interface ReferenceRule extends Rule<ReferenceRule, ReferenceValue> {}

/** @link https://www.sanity.io/docs/reference-type */
interface ReferenceFieldDef<DocumentNames extends string, Name extends string>
  extends FieldDef<Name, ReferenceRule, ReferenceValue> {
  options?: {
    disableNew?: boolean;
  } & ({ filter?: string; filterParams?: object } & {
    filter?: (context: {
      document: unknown;
      parent: unknown;
      parentPath: string;
    }) => MaybePromise<{
      filter: string;
      params: unknown;
    }>;
  });
  to: { type: DocumentNames }[];
  type: "reference";
  weak?: boolean;
}

/** @link https://www.sanity.io/docs/slug-type#validation */
interface SlugRule extends Rule<SlugRule, string> {}

/** @link https://www.sanity.io/docs/slug-typen */
interface SlugDef<Name extends string>
  extends FieldDef<Name, SlugRule, string> {
  options?: {
    isUnique?: (value: string, options: unknown) => MaybePromise<boolean>;
    maxLength?: number;
    slugify?: (value: string, type: unknown) => MaybePromise<string>;
    source?:
      | string
      | ((context: {
          doc: unknown;
          options: {
            parent: unknown;
            parentPath: string;
          };
        }) => string);
  };
  type: "slug";
}

/** @link https://www.sanity.io/docs/string-type#validation */
interface StringRule
  extends Rule<StringRule, string>,
    LengthRule<StringRule>,
    MinMaxRule<StringRule>,
    StringContentRule<StringRule> {}

/** @link https://www.sanity.io/docs/string-type */
interface StringFieldDef<Name extends string>
  extends FieldDef<Name, StringRule, string> {
  options?: ListOptions<string>;
  type: "string";
}

/** @link https://www.sanity.io/docs/text-type#validation */
interface TextRule
  extends Rule<TextRule, string>,
    LengthRule<TextRule>,
    MinMaxRule<TextRule>,
    StringContentRule<TextRule> {}

/** @link https://www.sanity.io/docs/text-type */
interface TextFieldDef<Name extends string>
  extends FieldDef<Name, TextRule, string> {
  type: "text";
}

/** @link https://www.sanity.io/docs/url-type#validation */
interface URLRule extends Rule<URLRule, string> {
  uri: (options: {
    allowRelative?: boolean;
    relativeOnly?: boolean;
    scheme?: string[];
  }) => URLRule;
}

/** @link https://www.sanity.io/docs/url-type */
interface URLFieldDef<Name extends string>
  extends FieldDef<Name, URLRule, string> {
  type: "url";
}

type PrimitiveFieldDef<Name extends string> =
  | BooleanFieldDef<Name>
  | DateFieldDef<Name>
  | DatetimeFieldDef<Name>
  | NumberFieldDef<Name>
  | StringFieldDef<Name>
  | TextFieldDef<Name>
  | URLFieldDef<Name>;

type NonPrimitiveFieldDef<
  DocumentNames extends string,
  ObjectNames extends string,
  Name extends string,
  FieldNames extends string
> =
  /* eslint-disable no-use-before-define -- Circular dependency */
  | FileFieldDef<DocumentNames, ObjectNames, Name, FieldNames>
  | ImageFieldDef<DocumentNames, ObjectNames, Name, FieldNames>
  | ObjectFieldDef<DocumentNames, ObjectNames, Name, FieldNames, string, string>
  /* eslint-enable no-use-before-define */
  | GeopointFieldDef<Name>
  | ReferenceFieldDef<DocumentNames, Name>
  | SlugDef<Name>;

/** @link https://www.sanity.io/docs/array-type#validation */
interface ArrayRule
  extends Rule<ArrayRule, unknown[]>,
    LengthRule<ArrayRule>,
    MinMaxRule<ArrayRule> {
  unique: () => ArrayRule;
}

/** @link https://www.sanity.io/docs/array-type */
interface ArrayFieldDef<
  DocumentNames extends string,
  ObjectNames extends string,
  Name extends string
> extends FieldDef<Name, ArrayRule, unknown[]> {
  of:
    | Omit<BlockFieldDef<never>, "name">[]
    | Omit<PrimitiveFieldDef<never>, "name">[]
    | (
        | Omit<
            NonPrimitiveFieldDef<DocumentNames, ObjectNames, never, string>,
            "name"
          >
        | Omit<ReferenceFieldDef<DocumentNames, never>, "name">
        | {
            title?: string;
            type: ObjectNames;
          }
      )[];
  options?: {
    editModal?: "dialog" | "fullscreen";
    layout?: "grid" | "tags";
    list?: ListItem<string>[];
    sortable?: boolean;
  };
  type: "array";
}

type FieldType<
  DocumentNames extends string,
  ObjectNames extends string,
  Name extends string,
  FieldNames extends string
> =
  | ArrayFieldDef<DocumentNames, ObjectNames, Name>
  | NonPrimitiveFieldDef<DocumentNames, ObjectNames, Name, FieldNames>
  | PrimitiveFieldDef<Name>;

type FileValue<FieldNames extends string> = Record<
  Exclude<FieldNames, "_type" | "asset">,
  string
> & {
  _type: "file";
  asset: ReferenceValue;
};

/** @link https://www.sanity.io/docs/arfileray-type#validation */
interface FileRule<FieldNames extends string>
  extends Rule<FileRule<FieldNames>, FileValue<FieldNames>> {}

/** @link https://www.sanity.io/docs/file-type */
interface FileFieldDef<
  DocumentNames extends string,
  ObjectNames extends string,
  Name extends string,
  FieldNames extends string
> extends FieldDef<Name, FileRule<FieldNames>, FileValue<FieldNames>> {
  fields?: FieldType<DocumentNames, ObjectNames, FieldNames, string>[];
  options?: {
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#unique_file_type_specifiers */
    accept?: string;
    /** @link https://www.sanity.io/docs/custom-asset-sources */
    sources?: unknown[];
    storeOriginalFilename?: boolean;
  };
  type: "file";
}

type ImageValue<FieldNames extends string> = Record<
  Exclude<FieldNames, "_type" | "asset" | "crop" | "hotspot">,
  string
> & {
  _type: "image";
  asset: ReferenceValue;
  crop: {
    bottom: number;
    left: number;
    right: number;
    top: number;
  };
  hotspot: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
};

/** @link https://www.sanity.io/docs/image-type#validation */
interface ImageRule<FieldNames extends string>
  extends Rule<ImageRule<FieldNames>, ImageValue<FieldNames>> {}

/** @link https://www.sanity.io/docs/image-type */
interface ImageFieldDef<
  DocumentNames extends string,
  ObjectNames extends string,
  Name extends string,
  FieldNames extends string
> extends FieldDef<Name, ImageRule<FieldNames>, unknown> {
  fields?: (FieldType<DocumentNames, ObjectNames, FieldNames, string> & {
    isHighlighted?: boolean;
  })[];
  options?: {
    /** @link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#unique_file_type_specifiers */
    accept?: string;
    hotspot?: boolean;
    /** @link https://www.sanity.io/docs/image-metadata */
    metadata?: string[];
    /** @link https://www.sanity.io/docs/custom-asset-sources */
    sources?: unknown[];
    storeOriginalFilename?: boolean;
  };
  type: "image";
}

interface ObjectLikeDef<
  DocumentNames extends string,
  ObjectNames extends string,
  FieldNames extends string,
  FieldSetNames extends string,
  SelectionNames extends string,
  GroupNames extends string
> {
  fields: (FieldType<DocumentNames, ObjectNames, FieldNames, string> & {
    /** @link https://www.sanity.io/docs/object-type#AbjN0ykp */
    fieldset?: FieldSetNames;
    /** @link https://www.sanity.io/docs/field-groups */
    group?: MaybeArray<GroupNames>;
  })[];
  /** @link https://www.sanity.io/docs/object-type#AbjN0ykp */
  fieldsets?: {
    name: FieldSetNames;
    title: string;
  }[];
  /** @link https://www.sanity.io/docs/previews-list-views */
  preview?:
    | {
        select: {
          media?: string | unknown;
          subtitle?: FieldNames;
          title?: FieldNames;
        };
      }
    | {
        component?: (props: {
          [name in SelectionNames]: unknown;
        }) => unknown;
        prepare: (selection: {
          [name in SelectionNames]: unknown;
        }) => {
          media?: string | unknown;
          subtitle?: FieldNames;
          title?: FieldNames;
        };
        select: {
          [name in SelectionNames]: FieldNames;
        };
      };
}

/** @link https://www.sanity.io/docs/object-type#validation */
interface ObjectRule extends Rule<ObjectRule, unknown> {}

/** @link https://www.sanity.io/docs/object-type */
interface ObjectFieldDef<
  DocumentNames extends string,
  ObjectNames extends string,
  Name extends string,
  FieldNames extends string,
  FieldSetNames extends string,
  SelectionNames extends string
> extends FieldDef<Name, ObjectRule, unknown>,
    ObjectLikeDef<
      DocumentNames,
      ObjectNames,
      FieldNames,
      FieldSetNames,
      SelectionNames,
      never
    > {
  inputComponent?: unknown;
  type: "object";
}

type ObjectDef<
  // DocumentNames & ObjectNames reversed!!! Mostly for convenience when defining types
  ObjectNames extends string,
  DocumentNames extends string = never,
  FieldNames extends string = string,
  FieldSetNames extends string = string,
  SelectionNames extends string = string
> = ObjectFieldDef<
  DocumentNames,
  ObjectNames,
  ObjectNames,
  FieldNames,
  FieldSetNames,
  SelectionNames
>;

/** @link https://www.sanity.io/docs/document-type */
interface DocumentDef<
  DocumentNames extends string,
  ObjectNames extends string = never,
  FieldNames extends string = string,
  FieldSetNames extends string = string,
  SelectionNames extends string = string,
  GroupNames extends string = string
> extends NamedDef<DocumentNames>,
    WithInitialValue<unknown>,
    ObjectLikeDef<
      DocumentNames,
      ObjectNames,
      FieldNames,
      FieldSetNames,
      SelectionNames,
      GroupNames
    > {
  /** @link https://www.sanity.io/docs/field-groups */
  groups?: (NamedDef<string> & {
    default?: boolean;
    hidden?: ConditionalField<unknown>;
    icon?: unknown;
  })[];
  liveEdit?: boolean;
  /** @link https://www.sanity.io/docs/sort-orders */
  orderings?: (NamedDef<string> & {
    by: {
      direction: "asc" | "desc";
      field: FieldNames;
    }[];
  })[];
  type: "document";
}

type SchemaType<
  DocumentNames extends string = any,
  ObjectNames extends string = any,
  FieldNames extends string = string,
  FieldSetNames extends string = string,
  SelectionNames extends string = string,
  GroupNames extends string = string
> =
  | DocumentDef<
      DocumentNames,
      ObjectNames,
      FieldNames,
      FieldSetNames,
      SelectionNames,
      GroupNames
    >
  | ObjectDef<
      ObjectNames,
      DocumentNames,
      FieldNames,
      FieldSetNames,
      SelectionNames
    >;

declare module "@sanity/base" {
  export const ObjectDef;

  export const DocumentDef;

  export const SchemaType;
}

declare module "part:@sanity/base/schema-creator" {
  import type { Schema } from "@sanity/schema/dist/dts/legacy/Schema";

  const createSchema: <
    DocumentNames extends string,
    ObjectNames extends string
  >(schemaDef: {
    name: string;
    types: SchemaType<DocumentNames, ObjectNames>[];
  }) => Schema;

  export default createSchema;

  export const ObjectDef;

  export const DocumentDef;

  export const SchemaType;
}

declare module "all:part:@sanity/base/schema-type" {
  const schemaTypes: SchemaType[];

  export default schemaTypes;
}