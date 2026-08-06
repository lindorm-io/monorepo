import { isArray, isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { CaseCallback } from "../types/index.js";
import { convertObjectArrayKeys } from "./convert-object-array-keys.js";

/**
 * `depth` is the number of key levels still available to convert. Descending
 * into an object VALUE spends one; an array does not (see
 * `convertObjectArrayKeys`). `Infinity` — the default — never runs out, so the
 * unlimited walk is bit-for-bit the original behaviour.
 */
export const convertObjectKeys = <T = any>(
  input: T,
  callback: CaseCallback,
  depth: number = Infinity,
): T => {
  if (!isObject(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  // Out of depth — the subtree is kept verbatim, by reference.
  if (depth < 1) {
    return input;
  }

  const result: Dict = {};

  for (const [key, value] of Object.entries(input)) {
    if (isObject(value)) {
      result[callback(key)] = convertObjectKeys(value, callback, depth - 1);
    } else if (isArray(value)) {
      result[callback(key)] = convertObjectArrayKeys(value, callback, depth - 1);
    } else {
      result[callback(key)] = value;
    }
  }

  return result as T;
};
