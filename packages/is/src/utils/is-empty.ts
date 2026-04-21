import { isArray } from "./is-array.js";
import { isNull } from "./is-null.js";
import { isObject } from "./is-object.js";
import { isString } from "./is-string.js";
import { isUndefined } from "./is-undefined.js";

export const isEmpty = (input: any): boolean => {
  if (isNull(input) || isUndefined(input)) {
    return true;
  }

  if (isString(input) || isArray(input)) {
    return input.length === 0;
  }

  if (isObject(input)) {
    return Object.keys(input).length === 0;
  }

  return false;
};
