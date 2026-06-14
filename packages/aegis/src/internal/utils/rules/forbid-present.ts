import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";

/**
 * None of the listed claims may be present. Mirrors the profile `forbidden`
 * floor as a composable rule.
 */
export const forbidPresent = (claims: Dict, keys: Array<string>): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  for (const key of keys) {
    if (claims[key] !== undefined) {
      invalid.push({ key, message: `Forbidden claim "${key}" is present` });
    }
  }

  return invalid;
};
