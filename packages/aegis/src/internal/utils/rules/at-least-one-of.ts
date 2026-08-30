import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimSatisfied } from "./is-claim-satisfied.js";

/**
 * At least one of the listed claims must be present — the implementation behind
 * an `atLeastOneOf` policy rule. One GROUP per rule: a profile that needs two
 * independent alternations declares two rules, so a group is never buried in a
 * nested array a reader has to index into.
 *
 * DEMAND presence, the same reading `required` uses — an alternation is a
 * demand with more than one way to satisfy it, so a member that names nothing
 * cannot be the one that satisfies it, and neither can a member the mint writer
 * would leave off the wire (`unreadable`).
 */
export const atLeastOneOf = (
  claims: Dict,
  keys: ReadonlyArray<string>,
  unreadable: ReadonlySet<string>,
): Array<InvalidEntry> =>
  keys.some((key) => !unreadable.has(key) && isClaimSatisfied(claims[key]))
    ? []
    : [
        {
          key: keys.join("|"),
          message: `At least one of [${keys.join(", ")}] is required`,
        },
      ];
