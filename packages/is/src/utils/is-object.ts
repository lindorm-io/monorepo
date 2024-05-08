import { isClass } from "./is-class";
import { isDate } from "./is-date";
import { isError } from "./is-error";
import { isObjectLike } from "./is-object-like";
import { isPromise } from "./is-promise";

export const isObject = (input: any): input is Record<string, any> =>
  Boolean(input) &&
  isObjectLike(input) &&
  !isClass(input) &&
  !isDate(input) &&
  !isError(input) &&
  !isPromise(input);
