import { isArrayStrict, isObjectStrict } from "@lindorm-io/core";
import { isBoolean } from "lodash";
import { parseErrorValue } from "./parse-error-value";
import { parseObjectValue } from "./parse-object-value";

export const parseArrayValue = (input: any, meta: Record<string, any>): Array<any> => {
  const parsed = isArrayStrict(input) ? input : JSON.parse(input);

  const result: Array<any> = [];

  for (const [index, value] of parsed.entries()) {
    if (isObjectStrict(meta[index])) {
      result.push(parseObjectValue(value, meta[index]));
    } else if (isArrayStrict(meta[index])) {
      result.push(parseArrayValue(value, meta[index]));
    } else if (meta[index] === "boolean") {
      result.push(isBoolean(value) ? value : JSON.parse(value));
    } else if (meta[index] === "date") {
      result.push(new Date(value));
    } else if (meta[index] === "error") {
      result.push(parseErrorValue(value));
    } else if (meta[index] === "number") {
      result.push(parseInt(value, 10));
    } else if (meta[index] === "string") {
      result.push(value);
    } else if (meta[index] === "null") {
      result.push(null);
    } else if (meta[index] === "undefined") {
      result.push(undefined);
    }
  }

  return result;
};
