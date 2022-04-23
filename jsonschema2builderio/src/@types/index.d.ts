import { JSONSchema7 } from 'json-schema';
import Ajv from 'ajv/dist/core';
import { Component } from '@builder.io/sdk/dist/src/builder.class';

declare namespace jsonschema2builderio {
  export interface ConvertParams {
    jsonSchema: JSONSchema7 | JSONSchema7[] | string | string[]
    definitions: JSONSchema7[]
    ajv: Ajv
    configLocation?: string
    collectionName?: string
  }

  export interface ComponentsCollection {
    components: Component[]
  }
}

export = jsonschema2builderio;
