/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable @rushstack/no-new-null */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
import { Maybe, Scalars } from './util.js';

export type ContentType = {
  id?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  exposeMutations?: Maybe<Scalars['Boolean']>;
  groups?: Maybe<Array<Maybe<ContentTypeGroup>>>;
  name?: Maybe<Scalars['String']>;
  previewImageUrl?: Maybe<Scalars['String']>;
  single?: Maybe<Scalars['Boolean']>;
  system?: Maybe<Scalars['Boolean']>;
  tagIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  title?: Maybe<Scalars['String']>;
  variant?: Maybe<ContentTypeVariant>;
};

export type ContentTypeGroup = {
  id?: Maybe<Scalars['String']>;
  contentTypeId?: Maybe<Scalars['String']>;
  fields?: Maybe<Array<Maybe<ContentTypeField>>>;
  name?: Maybe<Scalars['String']>;
  position?: Maybe<Scalars['Float']>;
};

export type ContentTypeField = {
  id?: Maybe<Scalars['String']>;
  groupId?: Maybe<Scalars['String']>;
  contentTypeId?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  options?: Maybe<ContentTypeFieldOptions>;
  system?: Maybe<Scalars['Boolean']>;
  title?: Maybe<Scalars['String']>;
  type?: Maybe<ContentFieldType>;
  position?: Maybe<Scalars['Float']>;
  primary?: Maybe<Scalars['Boolean']>;
  disableInApi?: Maybe<Scalars['Boolean']>;
  disableInUi?: Maybe<Scalars['Boolean']>;
  localized?: Maybe<Scalars['Boolean']>;
};

export type ContentTypeFieldOptions = {
  code?: Maybe<ContentTypeFieldCode>;
  connection?: Maybe<ContentTypeFieldConnection>;
  datetime?: Maybe<ContentTypeFieldDatetime>;
  disableInApi?: Maybe<Scalars['Boolean']>;
  disableInUi?: Maybe<Scalars['Boolean']>;
  extension?: Maybe<ContentTypeFieldExtension>;
  external?: Maybe<Scalars['String']>;
  file?: Maybe<ContentTypeFieldFile>;
  float?: Maybe<ContentTypeFieldFloat>;
  int?: Maybe<ContentTypeFieldInt>;
  localized?: Maybe<Scalars['Boolean']>;
  primary?: Maybe<Scalars['Boolean']>;
  required?: Maybe<Scalars['Boolean']>;
  richtext?: Maybe<ContentTypeFieldRichtext>;
  select?: Maybe<ContentTypeFieldSelect>;
  string?: Maybe<ContentTypeFieldString>;
  tag?: Maybe<ContentTypeFieldTag>;
  uniqueGlobal?: Maybe<Scalars['Boolean']>;
  uniqueLocal?: Maybe<Scalars['Boolean']>;
  video?: Maybe<ContentTypeFieldVideo>;
};

export type ContentTypeFieldCode = {
  languages?: Maybe<Array<Maybe<Scalars['String']>>>;
  max?: Maybe<Scalars['Float']>;
  min?: Maybe<Scalars['Float']>;
};

export type ContentTypeFieldConnection = {
  connectedIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  max?: Maybe<Scalars['Float']>;
  min?: Maybe<Scalars['Float']>;
  multiple?: Maybe<Scalars['Boolean']>;
  variant?: Maybe<ContentTypeVariant>;
  visualization?: Maybe<ContentTypeFieldConnectionVisualization>;
};

export type ContentTypeFieldDatetime = {
  max?: Maybe<Scalars['Float']>;
  min?: Maybe<Scalars['Float']>;
  time?: Maybe<Scalars['Boolean']>;
};

export type ContentTypeFieldExtension = {
  height?: Maybe<Scalars['Int']>;
  pattern?: Maybe<Scalars['String']>;
  url?: Maybe<Scalars['String']>;
};

export type ContentTypeFieldFile = {
  focalPoint?: Maybe<Scalars['Boolean']>;
  pattern?: Maybe<Scalars['String']>;
};

export type ContentTypeFieldFloat = {
  max?: Maybe<Scalars['Float']>;
  min?: Maybe<Scalars['Float']>;
};

export type ContentTypeFieldInt = {
  max?: Maybe<Scalars['Float']>;
  min?: Maybe<Scalars['Float']>;
};

export type ContentTypeFieldRichtext = {
  assetContentTypeIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  assetLinking?: Maybe<Scalars['Boolean']>;
  componentContentTypeIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  componentLinking?: Maybe<Scalars['Boolean']>;
  documentContentTypeIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  documentLinking?: Maybe<Scalars['Boolean']>;
  features?: Maybe<ContentTypeFieldRichtextFeatures>;
  max?: Maybe<Scalars['Float']>;
  min?: Maybe<Scalars['Float']>;
  pattern?: Maybe<Scalars['String']>;
};

export type ContentTypeFieldRichtextFeatures = {
  alignCenter?: Maybe<Scalars['Boolean']>;
  alignJustify?: Maybe<Scalars['Boolean']>;
  alignLeft?: Maybe<Scalars['Boolean']>;
  alignRight?: Maybe<Scalars['Boolean']>;
  blockquote?: Maybe<Scalars['Boolean']>;
  bold?: Maybe<Scalars['Boolean']>;
  code?: Maybe<Scalars['Boolean']>;
  codeblock?: Maybe<Scalars['Boolean']>;
  frame?: Maybe<Scalars['Boolean']>;
  h1?: Maybe<Scalars['Boolean']>;
  h2?: Maybe<Scalars['Boolean']>;
  h3?: Maybe<Scalars['Boolean']>;
  h4?: Maybe<Scalars['Boolean']>;
  h5?: Maybe<Scalars['Boolean']>;
  h6?: Maybe<Scalars['Boolean']>;
  italic?: Maybe<Scalars['Boolean']>;
  link?: Maybe<Scalars['Boolean']>;
  ol?: Maybe<Scalars['Boolean']>;
  table?: Maybe<Scalars['Boolean']>;
  ul?: Maybe<Scalars['Boolean']>;
};

export type ContentTypeFieldSelect = {
  items?: Maybe<Array<Maybe<ContentTypeFieldSelectItem>>>;
  max?: Maybe<Scalars['Float']>;
  min?: Maybe<Scalars['Float']>;
  multiple?: Maybe<Scalars['Boolean']>;
  outputEnumType?: Maybe<Scalars['Boolean']>;
};

export type ContentTypeFieldSelectItem = {
  key?: Maybe<Scalars['String']>;
  value?: Maybe<Scalars['String']>;
};

export type ContentTypeFieldString = {
  max?: Maybe<Scalars['Float']>;
  min?: Maybe<Scalars['Float']>;
  multiline?: Maybe<Scalars['Boolean']>;
  pattern?: Maybe<Scalars['String']>;
};

export type ContentTypeFieldTag = {
  max?: Maybe<Scalars['Float']>;
  min?: Maybe<Scalars['Float']>;
  pattern?: Maybe<Scalars['String']>;
};

export type ContentTypeFieldVideo = {
  pattern?: Maybe<Scalars['String']>;
};

export enum ContentTypeVariant {
  Document = 'DOCUMENT',
  Asset = 'ASSET',
  Component = 'COMPONENT',
  Template = 'TEMPLATE'
}

export enum ContentFieldType {
  Boolean = 'BOOLEAN',
  Code = 'CODE',
  Color = 'COLOR',
  Connection = 'CONNECTION',
  Datetime = 'DATETIME',
  Extension = 'EXTENSION',
  File = 'FILE',
  Float = 'FLOAT',
  Geopoint = 'GEOPOINT',
  Int = 'INT',
  Richtext = 'RICHTEXT',
  Select = 'SELECT',
  String = 'STRING',
  Tag = 'TAG',
  Video = 'VIDEO',
  Array = 'ARRAY'
}

export enum ContentTypeFieldConnectionVisualization {
  Deafult = 'DEAFULT',
  Grid = 'GRID',
  Inline = 'INLINE'
}
