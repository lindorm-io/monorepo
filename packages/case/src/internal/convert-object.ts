import { isArray, isNumber, isObject } from "@lindorm/is";
import type { CaseCallback, KeysInput, KeysOptions } from "../types/index.js";
import { convertObjectArrayKeys } from "./convert-object-array-keys.js";
import { convertObjectKeys } from "./convert-object-keys.js";

export const convertObject = <T extends KeysInput = KeysInput>(
  input: T,
  callback: CaseCallback,
  options: KeysOptions = {},
): T => {
  const { depth = Infinity } = options;

  if (!isNumber(depth) || depth < 1 || (depth !== Infinity && !Number.isInteger(depth))) {
    throw new Error(`Invalid depth [ ${depth} ]`);
  }

  if (isObject(input)) {
    return convertObjectKeys<T>(input, callback, depth);
  }
  if (isArray(input)) {
    return convertObjectArrayKeys<T>(input, callback, depth);
  }
  throw new Error(`Invalid type [ ${typeof input} ]`);
};
