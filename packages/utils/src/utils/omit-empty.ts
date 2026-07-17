import { isArray, isEmpty, isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitFromArray, omitFromObject } from "../internal/index.js";

export function omitEmpty<T extends Array<any> = Array<any>>(array: T): T;
export function omitEmpty<T extends Dict = Dict>(dict: T): T;
export function omitEmpty<T extends Array<any>>(arg: T): T {
  if (isArray(arg)) {
    return omitFromArray<T>(arg, isEmpty);
  }
  if (isObject(arg)) {
    return omitFromObject<T>(arg, isEmpty);
  }
  throw new TypeError(`Unsupported type [ ${typeof arg} ]`);
}
