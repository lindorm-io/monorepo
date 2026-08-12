import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimAbsent } from "./is-claim-absent.js";

/**
 * At least one of the listed claims must be present — the implementation behind
 * an `atLeastOneOf` policy rule. One GROUP per rule: a profile that needs two
 * independent alternations declares two rules, so a group is never buried in a
 * nested array a reader has to index into.
 */
export const atLeastOneOf = (
  claims: Dict,
  keys: ReadonlyArray<string>,
): Array<InvalidEntry> =>
  keys.some((key) => !isClaimAbsent(claims[key]))
    ? []
    : [
        {
          key: keys.join("|"),
          message: `At least one of [${keys.join(", ")}] is required`,
        },
      ];
