import { Dict } from "@lindorm/types";
import { isBuffer } from "./is-buffer";
import { isClass } from "./is-class";
import { isDate } from "./is-date";
import { isError } from "./is-error";
import { isObjectLike } from "./is-object-like";
import { isPromise } from "./is-promise";

export const isObject = <T extends Dict = Dict>(input: any): input is T =>
  Boolean(input) &&
  isObjectLike(input) &&
  !isBuffer(input) &&
  !isClass(input) &&
  !isDate(input) &&
  !isError(input) &&
  !isPromise(input);
