// helper functions for nicer syntax
// (we might write our own parser later, but at least for now
// this avoids seeing the raw json...)

import { JSONSchema7TypeName } from 'json-schema';

import {
  LensSource,
  ILensMap,
  ILensIn,
  IProperty,
  IAddProperty,
  IRemoveProperty,
  IRenameProperty,
  IHoistProperty,
  IPlungeProperty,
  IWrapProperty,
  IHeadProperty,
  ValueMapping,
  IConvertValue
} from './lens-ops.js';

export function addProperty(property: IProperty): IAddProperty {
  return {
    op: 'add',
    ...property
  };
}

export function removeProperty(property: IProperty): IRemoveProperty {
  return {
    op: 'remove',
    ...property
  };
}

export function renameProperty(source: string, destination: string): IRenameProperty {
  return {
    op: 'rename',
    source,
    destination
  };
}

export function hoistProperty(host: string, name: string): IHoistProperty {
  return {
    op: 'hoist',
    host,
    name
  };
}

export function plungeProperty(host: string, name: string): IPlungeProperty {
  return {
    op: 'plunge',
    host,
    name
  };
}

export function wrapProperty(name: string): IWrapProperty {
  return {
    op: 'wrap',
    name
  };
}

export function headProperty(name: string): IHeadProperty {
  return {
    op: 'head',
    name
  };
}

export function inside(name: string, lens: LensSource): ILensIn {
  return {
    op: 'in',
    name,
    lens
  };
}

export function map(lens: LensSource): ILensMap {
  return {
    op: 'map',
    lens
  };
}

export function convertValue(
  name: string,
  mapping: ValueMapping,
  sourceType?: JSONSchema7TypeName,
  destinationType?: JSONSchema7TypeName
): IConvertValue {
  return {
    op: 'convert',
    name,
    mapping,
    sourceType,
    destinationType
  };
}
