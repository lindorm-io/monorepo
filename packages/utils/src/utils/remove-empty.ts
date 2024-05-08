import { isArray, isEmpty, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { _removeFromArray, _removeFromObject } from "./private";

export function removeEmpty<T extends Array<any> = Array<any>>(array: T): T;
export function removeEmpty<T extends Dict = Dict>(dict: T): T;
export function removeEmpty<T extends Array<any>>(arg: T): T {
  if (isArray(arg)) {
    return _removeFromArray<T>(arg, isEmpty);
  }
  if (isObject(arg)) {
    return _removeFromObject<T>(arg, isEmpty);
  }
  throw new TypeError(`Unsupported type [ ${typeof arg} ]`);
}
