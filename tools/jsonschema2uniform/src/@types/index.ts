/* eslint-disable @typescript-eslint/naming-convention */
import { type JSONSchema } from 'json-schema-typed/draft-07';

import { IComponents } from './uniform-components.js';

declare type MyAjv = import('ajv').default;

export interface IConvertParams {
  schemaIds: string[];
  ajv: MyAjv;
  schemaPost?: (schema: JSONSchema.Interface) => JSONSchema.Interface;
}

export type UniformComponent = IComponents['schemas']['ComponentDefinition'];

export type UniformComponentParameter = NonNullable<UniformComponent['parameters']>[0];

export type UniformSlot = NonNullable<UniformComponent['slots']>[0];

export type UniformElement = UniformComponent | UniformComponentParameter | UniformSlot;

export interface TextParamConfig {
  required?: boolean;
  multiline?: boolean;
  linesCount?: number;
  regex?: string;
  regexMessage?: string;
  placeholder?: string;
  caption?: string;
}

export interface SelectParamConfiguration {
  options?: Array<{ value: string; text: string }>;
  required?: boolean;
}

export interface NumberParamConfig {
  required?: boolean;
  decimal?: boolean;
  decimalPlaces?: number;
  min?: number;
  max?: number;
  caption?: string;
  placeholder?: string;
}
