import { JSONSchema7 } from 'json-schema'
import Ajv from 'ajv/dist/core'

declare namespace jsonschema2tinacms {
  export interface ConvertParams {
    schemaIds: string[]
    ajv: Ajv
  }
}

export = jsonschema2tinacms;
