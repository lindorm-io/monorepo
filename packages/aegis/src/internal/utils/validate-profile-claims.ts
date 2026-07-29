import type { Condition } from "@lindorm/match";
import { Matcher } from "@lindorm/match";
import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { InvalidEntry, SignContext, TokenProfile } from "../../types/index.js";
import { algPermitted } from "./rules/alg-permitted.js";

export type ValidateProfileContext = {
  algorithm?: KryptosSigAlgorithm | "none";
};

/**
 * Runs a profile's structural validation against the DOMAIN-keyed common layer:
 *
 *   1. `profile.rules` — flat structural rules as a `Condition<DomainClaims>`,
 *      evaluated with the SAME matcher (`Matcher`) `assert`/`Aegis.assert`
 *      use; a mismatch names the failing claim keys,
 *   2. the crypto floor (`profile.algClass` via `algPermitted`),
 *   3. `profile.validate` — the imperative escape hatch for recursive /
 *      cross-field rules a flat predicate cannot express.
 *
 * Throws the existing `jwt_claims_invalid` error when any step fails.
 */
export const validateProfileClaims = (
  profile: TokenProfile,
  claims: Dict,
  ctx: SignContext & ValidateProfileContext = {},
): void => {
  const invalid: Array<InvalidEntry> = [];

  if (profile.rules) {
    invalid.push(...matchRules(claims, profile.rules));
  }

  if (profile.algClass) {
    invalid.push(...algPermitted(ctx.algorithm, profile.algClass));
  }

  invalid.push(...profile.validate(claims, ctx));

  if (invalid.length > 0) {
    throw new AegisDomainError("Invalid token", {
      code: "jwt_claims_invalid",
      data: { invalid },
      debug: { invalid, profile: profile.name },
      title: "JWT Claims Invalid",
      details: "The assembled claims do not satisfy the profile's RFC validation rules.",
    });
  }
};

/**
 * Evaluate the flat rule predicate; on a mismatch, re-check each field key in
 * isolation to report exactly which claim(s) failed (logical `$and`/`$or`/`$not`
 * top-level keys, if any, collapse to a single `rules` entry). Mirrors the
 * per-field diagnosis in `internal/utils/validate.ts`.
 */
const matchRules = (claims: Dict, rules: Condition<Dict>): Array<InvalidEntry> => {
  if (Matcher.match(claims, rules)) return [];

  const invalid: Array<InvalidEntry> = [];

  for (const [key, ops] of Object.entries(rules)) {
    if (key.startsWith("$")) {
      invalid.push({
        key: "rules",
        message: "The claims did not satisfy the profile rule predicate",
      });
      continue;
    }
    if (!Matcher.match({ [key]: claims[key] }, { [key]: ops } as Condition<Dict>)) {
      invalid.push({
        key,
        message: `Claim "${key}" did not satisfy the profile rule predicate`,
      });
    }
  }

  return invalid;
};
