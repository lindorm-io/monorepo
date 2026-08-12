import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimAbsent } from "./is-claim-absent.js";

/**
 * Each listed claim must be present. The implementation behind a `required`
 * policy rule, in whichever direction that rule declares.
 */
export const requirePresent = (
  claims: Dict,
  keys: ReadonlyArray<string>,
): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  for (const key of keys) {
    if (isClaimAbsent(claims[key])) {
      invalid.push({ key, message: `Required claim "${key}" is missing` });
    }
  }

  return invalid;
};
