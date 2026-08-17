import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimSatisfied } from "./is-claim-satisfied.js";

/**
 * Each listed claim must be present. The implementation behind a `required`
 * policy rule, in whichever direction that rule declares. DEMAND presence, so an
 * empty value is not one — `aud: []` names no audience.
 */
export const requirePresent = (
  claims: Dict,
  keys: ReadonlyArray<string>,
): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  for (const key of keys) {
    if (isClaimSatisfied(claims[key])) continue;

    invalid.push({ key, message: `Required claim "${key}" is missing` });
  }

  return invalid;
};
