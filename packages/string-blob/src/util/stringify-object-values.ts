import { isObjectStrict } from "@lindorm-io/core";
import { isArray, isDate, isError, isNull, isString, isUndefined } from "lodash";
import { stringifyArrayValues } from "./stringify-array-values";

export const stringifyObjectValues = (input: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(input)) {
    if (isObjectStrict(value)) {
      result[key] = stringifyObjectValues(value);
    } else if (isArray(value)) {
      result[key] = stringifyArrayValues(value);
    } else if (isDate(value)) {
      result[key] = value.toJSON();
    } else if (isError(value)) {
      result[key] = JSON.stringify(value, Object.getOwnPropertyNames(value));
    } else if (isString(value)) {
      result[key] = value;
    } else if (isNull(value)) {
      result[key] = "null";
    } else if (isUndefined(value)) {
      result[key] = "undefined";
    } else {
      result[key] = JSON.stringify(value);
    }
  }

  return result;
};
