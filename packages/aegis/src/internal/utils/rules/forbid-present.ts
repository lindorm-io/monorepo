import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimOmitted } from "./is-claim-omitted.js";

/**
 * None of the listed claims may be present. The implementation behind a
 * `forbidden` policy rule, in whichever direction that rule declares.
 *
 * VOCABULARY presence, NOT the demand notion `required` reads: naming a
 * forbidden claim at all is the violation, whatever value it was named with.
 * `at_hash: ""` on an `external_access_token` is a stated access-token hash on a
 * profile whose `forbidden` list IS its id-token defence.
 */
export const forbidPresent = (
  claims: Dict,
  keys: ReadonlyArray<string>,
): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  for (const key of keys) {
    if (isClaimOmitted(claims[key])) continue;

    invalid.push({ key, message: `Forbidden claim "${key}" is present` });
  }

  return invalid;
};
