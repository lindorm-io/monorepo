import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimAbsent } from "./is-claim-absent.js";

/**
 * None of the listed claims may be present. The implementation behind a
 * `forbidden` policy rule, in whichever direction that rule declares.
 */
export const forbidPresent = (
  claims: Dict,
  keys: ReadonlyArray<string>,
): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  for (const key of keys) {
    if (!isClaimAbsent(claims[key])) {
      invalid.push({ key, message: `Forbidden claim "${key}" is present` });
    }
  }

  return invalid;
};
