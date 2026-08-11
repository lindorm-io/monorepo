import type { Condition } from "@lindorm/match";
import { Matcher } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry, SignContext, TokenProfile } from "../../types/index.js";

/**
 * A profile's STRUCTURAL policy — `rules` then `validate` — evaluated against the
 * DOMAIN-keyed claim layer, returning the failures rather than throwing so both
 * sides can compose it with their own additional checks.
 *
 * Shared BY EXTRACTION, deliberately: these two fields ran at mint only, and the
 * profile type documented them as applying "on whichever side the profile is
 * used". Copying the block to the verify floor would have restored the same
 * arrangement that let them drift apart.
 *
 * ⚠ `algClass` is NOT here. Mint folds it into the same failure list; verify
 * checks it FIRST and under its own code, because an algorithm the profile
 * forbids decides whether the signature proves anything at all — reporting a
 * structural mismatch on such a token would name the lesser problem.
 *
 * `ctx` is the mint-time {@link SignContext}, and verify passes `{}`: no
 * built-in profile's `validate` reads it, and the fields it would carry are
 * facts only the issuer has. That is the same reason `requiredWhen` stays
 * mint-only — `id_token`'s condition asks whether an access token was
 * co-issued, which a verifier cannot know.
 */
export const applyProfilePolicy = (
  profile: TokenProfile,
  claims: Dict,
  ctx: SignContext = {},
): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  if (profile.rules) {
    invalid.push(...matchRules(claims, profile.rules));
  }

  invalid.push(...profile.validate(claims, ctx));

  return invalid;
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
