import { JSONSchema7 } from 'json-schema'
import Ajv from 'ajv/dist/core'

declare namespace jsonschema2tinacms {
  export interface ConvertParams {
    jsonSchema: JSONSchema7 | JSONSchema7[] | string | string[]
    definitions: JSONSchema7[]
    ajv: Ajv
    configLocation?: string
  }
}

export = jsonschema2tinacms;
