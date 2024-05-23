import { isArray, isEmpty, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { removeFromArray } from "./private/remove-from-array";
import { removeFromObject } from "./private/remove-from-object";

export function removeEmpty<T extends Array<any> = Array<any>>(array: T): T;
export function removeEmpty<T extends Dict = Dict>(dict: T): T;
export function removeEmpty<T extends Array<any>>(arg: T): T {
  if (isArray(arg)) {
    return removeFromArray<T>(arg, isEmpty);
  }
  if (isObject(arg)) {
    return removeFromObject<T>(arg, isEmpty);
  }
  throw new TypeError(`Unsupported type [ ${typeof arg} ]`);
}
