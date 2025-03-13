import {
  isArray,
  isBuffer,
  isDate,
  isNull,
  isObject,
  isString,
  isUndefined,
} from "@lindorm/is";
import { stringifyObjectValues } from "./stringify-object-values";

export const stringifyArrayValues = (input: Array<any>): Array<any> => {
  const result: Array<any> = [];

  for (const value of input) {
    if (isDate(value)) {
      result.push(value.toISOString());
    } else if (isObject(value)) {
      result.push(stringifyObjectValues(value));
    } else if (isArray(value)) {
      result.push(stringifyArrayValues(value));
    } else if (isString(value)) {
      result.push(value);
    } else if (isNull(value)) {
      result.push(0);
    } else if (isUndefined(value)) {
      result.push(0);
    } else if (isBuffer(value)) {
      result.push(value.toString("base64url"));
    } else {
      result.push(JSON.stringify(value));
    }
  }

  return result;
};
