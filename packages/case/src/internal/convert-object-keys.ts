import { isArray, isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { CaseCallback } from "../types/index.js";
import { convertObjectArrayKeys } from "./convert-object-array-keys.js";
import type { WalkOptions } from "./walk-options.js";

/**
 * `walk.depth` is the number of key levels still available to convert.
 * Descending into an object VALUE spends one; an array does not (see
 * `convertObjectArrayKeys`); `Infinity` never runs out. An exempt key is
 * checked before descent and spends none.
 */
export const convertObjectKeys = <T = any>(
  input: T,
  callback: CaseCallback,
  walk: WalkOptions,
): T => {
  if (!isObject(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  // Out of depth — the subtree is kept verbatim, by reference.
  if (walk.depth < 1) {
    return input;
  }

  const result: Dict = {};

  for (const [key, value] of Object.entries(input)) {
    // Exempt — the key and its value are kept verbatim, by reference.
    if (walk.exempt(key) === true) {
      result[key] = value;
    } else if (isObject(value)) {
      result[callback(key)] = convertObjectKeys(value, callback, {
        ...walk,
        depth: walk.depth - 1,
      });
    } else if (isArray(value)) {
      result[callback(key)] = convertObjectArrayKeys(value, callback, {
        ...walk,
        depth: walk.depth - 1,
      });
    } else {
      result[callback(key)] = value;
    }
  }

  return result as T;
};
