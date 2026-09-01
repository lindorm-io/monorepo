import { isArray, isNumber, isObject } from "@lindorm/is";
import type { CaseCallback, KeysInput, KeysOptions } from "../types/index.js";
import { convertObjectArrayKeys } from "./convert-object-array-keys.js";
import { convertObjectKeys } from "./convert-object-keys.js";
import type { WalkOptions } from "./walk-options.js";

const NEVER_EXEMPT = (): boolean => false;

export const convertObject = <T extends KeysInput = KeysInput>(
  input: T,
  callback: CaseCallback,
  options: KeysOptions = {},
): T => {
  const { depth = Infinity, exempt = NEVER_EXEMPT } = options;

  if (!isNumber(depth) || depth < 1 || (depth !== Infinity && !Number.isInteger(depth))) {
    throw new Error(`Invalid depth [ ${depth} ]`);
  }

  const walk: WalkOptions = { depth, exempt };

  if (isObject(input)) {
    return convertObjectKeys<T>(input, callback, walk);
  }
  if (isArray(input)) {
    return convertObjectArrayKeys<T>(input, callback, walk);
  }
  throw new Error(`Invalid type [ ${typeof input} ]`);
};
