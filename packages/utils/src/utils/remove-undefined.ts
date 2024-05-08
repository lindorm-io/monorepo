import { isArray, isObject, isUndefined } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { _removeFromArray, _removeFromObject } from "./private";

export function removeUndefined<T extends Array<any> = Array<any>>(array: T): T;
export function removeUndefined<T extends Dict = Dict>(dict: T): T;
export function removeUndefined<T extends Array<any>>(arg: T): T {
  if (isArray(arg)) {
    return _removeFromArray<T>(arg, isUndefined);
  }
  if (isObject(arg)) {
    return _removeFromObject<T>(arg, isUndefined);
  }
  throw new TypeError(`Unsupported type [ ${typeof arg} ]`);
}
