import { isArray, isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimOmitted } from "./is-claim-omitted.js";
import { isClaimSatisfied } from "./is-claim-satisfied.js";

/**
 * When `claim` is present it must be an array whose every element is an object
 * carrying a non-empty `member` (string). Backs RFC 9396 `authorization_details`
 * — every element must be an object with a required `type`.
 *
 * ⚠ The member is a DEMAND, so it reads `isClaimSatisfied` and not mere
 * presence. RFC 9396 §2, verbatim (no markup added inside the quote):
 *   type: An identifier for the authorization details type as a string. The
 *   value of the type field determines the allowable contents of the object
 *   that contains it. The value is unique for the described API in the context
 *   of the AS. This field is REQUIRED.
 * An element whose `type` is `""` identifies nothing, so nothing can be looked
 * up to interpret the rest of it. A bare presence check admitted it.
 */
export const everyElementHasKey = (
  claims: Dict,
  claim: string,
  member: string,
): Array<InvalidEntry> => {
  const value = claims[claim];

  if (isClaimOmitted(value)) return [];

  if (!isArray(value)) {
    return [{ key: claim, message: `Claim "${claim}" must be an array` }];
  }

  const invalid: Array<InvalidEntry> = [];

  value.forEach((element, index) => {
    if (
      isObject(element) &&
      isString(element[member]) &&
      isClaimSatisfied(element[member])
    )
      return;

    invalid.push({
      key: `${claim}[${index}]`,
      message: `Each "${claim}" element must be an object with a non-empty "${member}" string member`,
    });
  });

  return invalid;
};
