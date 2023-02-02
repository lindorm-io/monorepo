import { isClass } from "./is-class";
import { isDate } from "./is-date";
import { isError } from "./is-error";
import { isObjectLike } from "./is-object-like";

export const isObject = (input: any): input is Record<string, any> =>
  isObjectLike(input) && !isClass(input) && !isDate(input) && !isError(input);
