import type { Dict } from "@lindorm/types";

/**
 * Swaps keys and values in a string dictionary.
 *
 * Assumes an injective (one-to-one) mapping. If two keys map to the same
 * value, only the last one survives in the reversed dict.
 */
export const reverseDictValues = (dict: Dict<string>): Dict<string> => {
  const result: Dict<string> = {};
  for (const [key, value] of Object.entries(dict)) {
    result[value] = key;
  }
  return result;
};
