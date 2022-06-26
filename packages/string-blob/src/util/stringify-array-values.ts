import { isArray, isDate, isError, isNull, isString, isUndefined } from "lodash";
import { isObjectStrict } from "@lindorm-io/core";
import { stringifyObjectValues } from "./stringify-object-values";

export const stringifyArrayValues = (input: Array<any>): Array<any> => {
  const result: Array<any> = [];

  for (const value of input) {
    if (isObjectStrict(value)) {
      result.push(stringifyObjectValues(value));
    } else if (isArray(value)) {
      result.push(stringifyArrayValues(value));
    } else if (isDate(value)) {
      result.push(value.toJSON());
    } else if (isError(value)) {
      result.push(JSON.stringify(value, Object.getOwnPropertyNames(value)));
    } else if (isString(value)) {
      result.push(value);
    } else if (isNull(value)) {
      result.push("null");
    } else if (isUndefined(value)) {
      result.push("undefined");
    } else {
      result.push(JSON.stringify(value));
    }
  }

  return result;
};
