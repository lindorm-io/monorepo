import { isArray, isDate, isNull, isObject, isString, isUndefined } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { _stringifyArrayValues } from "./stringify-array-values";

export const _stringifyObjectValues = (dict: Dict): Dict => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(dict)) {
    if (isObject(value)) {
      result[key] = _stringifyObjectValues(value);
    } else if (isArray(value)) {
      result[key] = _stringifyArrayValues(value);
    } else if (isDate(value)) {
      result[key] = value.toISOString();
    } else if (isString(value)) {
      result[key] = value;
    } else if (isNull(value)) {
      result[key] = 0;
    } else if (isUndefined(value)) {
      result[key] = 0;
    } else {
      result[key] = JSON.stringify(value);
    }
  }

  return result;
};
