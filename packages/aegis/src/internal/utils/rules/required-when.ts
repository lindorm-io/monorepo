import type { Dict } from "@lindorm/types";
import type { InvalidEntry, SignContext } from "../../../types/index.js";

export type RequiredWhenRule = {
  claim: string;
  when: (claims: Dict, ctx: SignContext) => boolean;
};

/**
 * A claim is required when its `when` predicate (evaluated against the
 * assembled claims + mint context) is true. Used for C-class claims such as
 * `at_hash` (required when an access token co-issues) or `auth_time`
 * (required when `max_age` was requested).
 */
export const requiredWhen = (
  claims: Dict,
  ctx: SignContext,
  rules: Array<RequiredWhenRule>,
): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  for (const { claim, when } of rules) {
    if (claims[claim] === undefined && when(claims, ctx)) {
      invalid.push({
        key: claim,
        message: `Conditionally required claim "${claim}" is missing`,
      });
    }
  }

  return invalid;
};
