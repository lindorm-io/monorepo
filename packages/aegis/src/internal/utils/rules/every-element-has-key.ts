import { isArray, isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";

/**
 * When `claim` is present it must be an array whose every element is an object
 * carrying a non-empty `member` (string). Backs RFC 9396 `authorization_details`
 * — every element must be an object with a required `type`.
 */
export const everyElementHasKey = (
  claims: Dict,
  claim: string,
  member: string,
): Array<InvalidEntry> => {
  const value = claims[claim];

  if (value === undefined) return [];

  if (!isArray(value)) {
    return [{ key: claim, message: `Claim "${claim}" must be an array` }];
  }

  const invalid: Array<InvalidEntry> = [];

  value.forEach((element, index) => {
    if (!isObject(element) || typeof element[member] !== "string") {
      invalid.push({
        key: `${claim}[${index}]`,
        message: `Each "${claim}" element must be an object with a "${member}" string member`,
      });
    }
  });

  return invalid;
};
