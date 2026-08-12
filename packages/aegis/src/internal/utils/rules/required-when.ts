import type { Dict } from "@lindorm/types";
import type { InvalidEntry, SignContext } from "../../../types/index.js";
import { isClaimAbsent } from "./is-claim-absent.js";

/** The conditional-presence rule, without the direction/context bookkeeping. */
export type RequiredWhenRule = {
  claim: string;
  when: (claims: Dict, context: SignContext) => boolean;
};

/**
 * A claim is required when its `when` predicate (evaluated against the assembled
 * claims + the mint context) holds. The implementation behind a `requiredWhen`
 * policy rule — the only rule that reads the context, which is why the rule type
 * pins it to mint and makes it declare the context keys it reads.
 */
export const requiredWhen = (
  claims: Dict,
  context: SignContext,
  rule: RequiredWhenRule,
): Array<InvalidEntry> =>
  isClaimAbsent(claims[rule.claim]) && rule.when(claims, context)
    ? [
        {
          key: rule.claim,
          message: `Conditionally required claim "${rule.claim}" is missing`,
        },
      ]
    : [];
