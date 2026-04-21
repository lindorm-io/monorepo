import { isArray, isObject } from "@lindorm/is";
import type { CaseCallback, KeysInput } from "../types/index.js";
import { convertObjectArrayKeys } from "./convert-object-array-keys.js";
import { convertObjectKeys } from "./convert-object-keys.js";

export const convertObject = <T extends KeysInput = KeysInput>(
  input: T,
  callback: CaseCallback,
): T => {
  if (isObject(input)) {
    return convertObjectKeys<T>(input, callback);
  }
  if (isArray(input)) {
    return convertObjectArrayKeys<T>(input, callback);
  }
  throw new Error(`Invalid type [ ${typeof input} ]`);
};
