import { isArray, isObject } from "@lindorm/is";
import type { CaseCallback, KeysInput } from "../types/index.js";
import { convertObjectKeys } from "./convert-object-keys.js";
import type { WalkOptions } from "./walk-options.js";

/**
 * An array is a transparent container: it has no keys of its own, so entering
 * one does NOT spend a level. Its items are walked with the SAME `walk` the
 * array itself was reached with.
 */
export const convertObjectArrayKeys = <T extends KeysInput = KeysInput>(
  input: T,
  callback: CaseCallback,
  walk: WalkOptions,
): T => {
  if (!isArray(input)) {
    throw new Error(`Invalid input [ ${typeof input} ]`);
  }

  // Out of depth — the subtree is kept verbatim, by reference.
  if (walk.depth < 1) {
    return input;
  }

  const result: Array<any> = [];

  for (const item of input) {
    if (isObject(item)) {
      result.push(convertObjectKeys(item, callback, walk));
    } else if (isArray(item)) {
      result.push(convertObjectArrayKeys(item, callback, walk));
    } else {
      result.push(item);
    }
  }

  return result as T;
};
