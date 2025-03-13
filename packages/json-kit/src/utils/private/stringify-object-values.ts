import {
  isArray,
  isBuffer,
  isDate,
  isNull,
  isObject,
  isString,
  isUndefined,
} from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { stringifyArrayValues } from "./stringify-array-values";

export const stringifyObjectValues = (dict: Dict): Dict => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(dict)) {
    if (isDate(value)) {
      result[key] = value.toISOString();
    } else if (isObject(value)) {
      result[key] = stringifyObjectValues(value);
    } else if (isArray(value)) {
      result[key] = stringifyArrayValues(value);
    } else if (isString(value)) {
      result[key] = value;
    } else if (isNull(value)) {
      result[key] = 0;
    } else if (isUndefined(value)) {
      result[key] = 0;
    } else if (isBuffer(value)) {
      result[key] = value.toString("base64url");
    } else {
      result[key] = JSON.stringify(value);
    }
  }

  return result;
};
