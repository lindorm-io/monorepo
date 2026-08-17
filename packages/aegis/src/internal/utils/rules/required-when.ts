import type { Dict } from "@lindorm/types";
import type { InvalidEntry, SignContext } from "../../../types/index.js";
import { isClaimSatisfied } from "./is-claim-satisfied.js";

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
 *
 * DEMAND presence, as `required`. Note the ordering: a satisfied claim short-
 * circuits, so the author's `when` predicate only ever runs on an EMPTY value.
 */
export const requiredWhen = (
  claims: Dict,
  context: SignContext,
  rule: RequiredWhenRule,
): Array<InvalidEntry> => {
  if (isClaimSatisfied(claims[rule.claim])) return [];

  return rule.when(claims, context)
    ? [
        {
          key: rule.claim,
          message: `Conditionally required claim "${rule.claim}" is missing`,
        },
      ]
    : [];
};
