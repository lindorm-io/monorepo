import { isArray } from "./is-array.js";
import { isMap } from "./is-map.js";
import { isNull } from "./is-null.js";
import { isObject } from "./is-object.js";
import { isSet } from "./is-set.js";
import { isString } from "./is-string.js";
import { isUndefined } from "./is-undefined.js";

export const isEmpty = (input: any): boolean => {
  if (isNull(input) || isUndefined(input)) {
    return true;
  }

  if (isString(input) || isArray(input)) {
    return input.length === 0;
  }

  // A `Map` / `Set` keeps its entries where `Object.entries` cannot see them, so
  // emptiness has to come from `size`. They are the only exotics with an
  // unambiguous notion of it — for a buffer, "empty" would mean `byteLength`,
  // a different enough question that answering it silently is worse than not.
  if (isMap(input) || isSet(input)) {
    return input.size === 0;
  }

  if (isObject(input)) {
    return Object.keys(input).length === 0;
  }

  return false;
};
