import { isArray, isDate, isNull, isObject, isString, isUndefined } from "@lindorm/is";
import { _stringifyObjectValues } from "./stringify-object-values";

export const _stringifyArrayValues = (input: Array<any>): Array<any> => {
  const result: Array<any> = [];

  for (const value of input) {
    if (isObject(value)) {
      result.push(_stringifyObjectValues(value));
    } else if (isArray(value)) {
      result.push(_stringifyArrayValues(value));
    } else if (isDate(value)) {
      result.push(value.toISOString());
    } else if (isString(value)) {
      result.push(value);
    } else if (isNull(value)) {
      result.push(0);
    } else if (isUndefined(value)) {
      result.push(0);
    } else {
      result.push(JSON.stringify(value));
    }
  }

  return result;
};
