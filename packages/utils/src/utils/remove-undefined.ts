import { isArray, isObject, isUndefined } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { removeFromArray } from "./private/remove-from-array";
import { removeFromObject } from "./private/remove-from-object";

export function removeUndefined<T extends Array<any> = Array<any>>(array: T): T;
export function removeUndefined<T extends Dict = Dict>(dict: T): T;
export function removeUndefined<T extends Array<any>>(arg: T): T {
  if (isArray(arg)) {
    return removeFromArray<T>(arg, isUndefined);
  }
  if (isObject(arg)) {
    return removeFromObject<T>(arg, isUndefined);
  }
  throw new TypeError(`Unsupported type [ ${typeof arg} ]`);
}
