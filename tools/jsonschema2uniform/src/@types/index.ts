import { IComponents } from './uniform-components.js';

export type UniformComponent = IComponents['schemas']['ComponentDefinition'];

export type UniformComponentParameter = NonNullable<UniformComponent['parameters']>[0];

export type UniformSlot = NonNullable<UniformComponent['slots']>[0];

export type UniformElement = UniformComponent | UniformComponentParameter | UniformSlot;

export interface ITextParamConfig {
  required?: boolean;
  multiline?: boolean;
  linesCount?: number;
  regex?: string;
  regexMessage?: string;
  placeholder?: string;
  caption?: string;
}

export interface ISelectParamConfiguration {
  options?: Array<{ value: string; text: string }>;
  required?: boolean;
}

export interface INumberParamConfig {
  required?: boolean;
  decimal?: boolean;
  decimalPlaces?: number;
  min?: number;
  max?: number;
  caption?: string;
  placeholder?: string;
}
