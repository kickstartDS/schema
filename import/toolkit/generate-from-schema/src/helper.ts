import { isUndefined } from "lodash";
import { JSONSchema7 } from "json-schema";
import Ajv from "ajv";

export const createGetSchema =
  (ajv: Ajv) =>
  (id: string): JSONSchema7 => {
    const [rootId, hash = ""] = id.split("#");
    const hashPath = hash.split("/").filter(Boolean);
    const rootSchema = ajv.getSchema(rootId)?.schema;

    if (isUndefined(rootSchema)) {
      throw new Error(`Cannot read schema: ${rootId}`);
    }

    return hashPath.reduce((schema: any, property, i) => {
      if (property in schema) {
        if (schema[property].$ref) {
          return ajv.getSchema(schema[property].$ref)?.schema;
        }
        return schema[property];
      }
      throw new Error(
        `Cannot read schema: ${rootId}#/${hashPath.slice(0, i + 1).join("/")}`
      );
    }, rootSchema);
  };
