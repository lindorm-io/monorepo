import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";

/**
 * Each listed claim must be present (not `undefined`). Mirrors the profile
 * `required` floor as a composable rule for use inside `validate`.
 */
export const requirePresent = (
  claims: Dict,
  keys: Array<string>,
): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  for (const key of keys) {
    if (claims[key] === undefined) {
      invalid.push({ key, message: `Required claim "${key}" is missing` });
    }
  }

  return invalid;
};
