import type { Dict } from "@lindorm/types";
import { isBuffer } from "./is-buffer.js";
import { isClass } from "./is-class.js";
import { isDate } from "./is-date.js";
import { isError } from "./is-error.js";
import { isObjectLike } from "./is-object-like.js";
import { isPromise } from "./is-promise.js";

export const isObject = <T extends Dict = Dict>(input: any): input is T =>
  Boolean(input) &&
  isObjectLike(input) &&
  !isBuffer(input) &&
  !isClass(input) &&
  !isDate(input) &&
  !isError(input) &&
  !isPromise(input);
