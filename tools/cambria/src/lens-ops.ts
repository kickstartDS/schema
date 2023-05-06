import { JSONSchema7Type, JSONSchema7TypeName } from 'json-schema'

export interface IProperty {
  name?: string
  type: JSONSchema7TypeName | JSONSchema7TypeName[]
  default?: JSONSchema7Type | undefined
  required?: boolean
  items?: IProperty
}

export interface IAddProperty extends IProperty {
  op: 'add'
}

export interface IRemoveProperty extends IProperty {
  op: 'remove'
}

export interface IRenameProperty {
  op: 'rename'
  source: string
  destination: string
}

export interface IHoistProperty {
  op: 'hoist'
  name: string
  host: string
}

export interface IPlungeProperty {
  op: 'plunge'
  name: string
  host: string
}
export interface IWrapProperty {
  op: 'wrap'
  name: string
}

export interface IHeadProperty {
  op: 'head'
  name: string
}

export interface ILensIn {
  op: 'in'
  name: string
  lens: LensSource
}

export interface ILensMap {
  op: 'map'
  lens: LensSource
}

// ideally this would be a tuple, but the typechecker
// wouldn't let me assign a flipped array in the reverse lens op
export type ValueMapping = { [key: string]: unknown }[]

// Notes on value conversion:
// - Types are optional, only needed if the type is actually changing
// - We only support hardcoded mappings for the time being;
//   can consider further conversions later
export interface IConvertValue {
  op: 'convert'
  name: string
  mapping: ValueMapping
  sourceType?: JSONSchema7TypeName
  destinationType?: JSONSchema7TypeName
}

export type LensOp =
  | IAddProperty
  | IRemoveProperty
  | IRenameProperty
  | IHoistProperty
  | IWrapProperty
  | IHeadProperty
  | IPlungeProperty
  | ILensIn
  | ILensMap
  | IConvertValue

export type LensSource = LensOp[]
