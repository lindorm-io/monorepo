import { isArray } from "./is-array";
import { isNull } from "./is-null";
import { isObject } from "./is-object";
import { isString } from "./is-string";
import { isUndefined } from "./is-undefined";

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
