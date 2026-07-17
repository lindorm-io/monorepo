import { isArray, isObjectLike, isUndefined } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitFromArray, omitFromObject } from "../internal/index.js";

export function omitUndefined<T extends Array<any> = Array<any>>(array: T): T;
export function omitUndefined<T extends Dict = Dict>(dict: T): T;
export function omitUndefined<T extends Array<any>>(arg: T): T {
  if (isArray(arg)) {
    return omitFromArray<T>(arg, isUndefined);
  }
  if (isObjectLike(arg)) {
    return omitFromObject<T>(arg, isUndefined);
  }
  throw new TypeError(`Unsupported type [ ${typeof arg} ]`);
}
