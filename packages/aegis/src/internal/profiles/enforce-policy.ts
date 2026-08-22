import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type {
  Direction,
  InvalidEntry,
  SignContext,
  TokenFormatTag,
  TokenProfile,
} from "../../types/index.js";
import {
  atLeastOneOf,
  forbidPresent,
  matchCondition,
  requirePresent,
  requiredWhen,
} from "../utils/rules/index.js";
import { SHAPE_RULES } from "./shape-rules.js";

export type EnforcePolicyInput = {
  /** The DOMAIN-keyed claim layer. Both directions produce this same shape. */
  claims: Dict;
  /** Mint-time facts only the issuer has. Verify passes `{}` and always can. */
  context: SignContext;
  direction: Direction;
  /** DIAGNOSTIC only — every code raised here is wire-neutral. */
  format: TokenFormatTag;
  profile: TokenProfile;
};

/**
 * THE profile-policy enforcer — one implementation, both directions.
 *
 * ⚠ DIRECTION IS A PROPERTY OF THE RULE, never of the call site. Deciding it per
 * caller is what lets a rule be enforced at mint and skipped at verify — the half
 * that matters, since a verifier is reading someone else's token.
 *
 * Every failure is collected before anything is thrown, so one bad token reports
 * every reason it is bad rather than the first category reached.
 */
/**
 * Whether a rule runs in the direction being enforced. A function, not an inline
 * `rule.on.includes(direction)`: a `BoundRule`'s `on` is the pinned tuple
 * `["mint"]`, whose own `includes` accepts only `"mint"`, so asking it about
 * `"verify"` is a type error at the call site. Widening happens ONCE, here.
 */
const runsIn = (on: ReadonlyArray<Direction>, direction: Direction): boolean =>
  on.includes(direction);

export const enforcePolicy = ({
  claims,
  context,
  direction,
  format,
  profile,
}: EnforcePolicyInput): void => {
  const invalid: Array<InvalidEntry> = [];

  for (const rule of profile.policy) {
    if (!runsIn(rule.on, direction)) continue;

    switch (rule.rule) {
      case "required":
        invalid.push(...requirePresent(claims, rule.claims));
        break;

      case "forbidden":
        invalid.push(...forbidPresent(claims, rule.claims));
        break;

      case "atLeastOneOf":
        invalid.push(...atLeastOneOf(claims, rule.claims));
        break;

      case "match":
        invalid.push(...matchCondition(claims, rule.condition));
        break;

      case "shape":
        invalid.push(...SHAPE_RULES[rule.shape](claims));
        break;

      case "requiredWhen": {
        // A context-reading rule that is not given its context does not fail — it
        // silently does not fire, so a misspelt `accessTokenIssued` would mint an
        // id_token with no access-token hash and no error. The missing fact is
        // refused rather than read as `false`.
        //
        // ⚠ `Object.hasOwn`, NEVER `in`. A profile is CALLER-REGISTERED
        // (`Aegis.registerProfile`), so `needs` is caller data, and with `in` a key
        // spelled `constructor`/`toString`/`valueOf` resolves through
        // `Object.prototype` and counts as SUPPLIED — a gate that fails open. `in`
        // on a caller-influenced key is a BANNED construct in this package.
        const missing = rule.needs.filter((key) => !Object.hasOwn(context, key));

        if (missing.length > 0) {
          throw new AegisDomainError("Mint context is incomplete", {
            code: "missing_sign_context",
            data: { missing, format },
            debug: { claim: rule.claim, missing, profile: profile.name },
            title: "Missing Sign Context",
            details:
              "A profile rule reads mint-time facts the caller did not supply, so it cannot be evaluated. Supply every named key in the mint context; a fact that is false must be stated as false.",
          });
        }

        invalid.push(...requiredWhen(claims, context, rule));
        break;
      }

      default: {
        const exhaustive: never = rule;
        throw new AegisDomainError("Unsupported policy rule", {
          code: "unsupported_policy_rule",
          data: { rule: exhaustive, format },
          debug: { profile: profile.name },
          title: "Unsupported Policy Rule",
          details:
            "The profile declares a policy rule this build does not implement, so its policy cannot be enforced.",
        });
      }
    }
  }

  if (invalid.length > 0) {
    throw new AegisDomainError("Invalid token", {
      code: "profile_policy_invalid",
      data: { direction, invalid, format },
      debug: { direction, invalid, profile: profile.name },
      title: "Profile Policy Invalid",
      details:
        "The claims do not satisfy the policy the profile declares for this direction.",
    });
  }
};
