import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { InvalidEntry, SignContext, TokenProfile } from "../../types/index.js";
import { applyProfilePolicy } from "./apply-profile-policy.js";
import { algPermitted } from "./rules/alg-permitted.js";

export type ValidateProfileContext = {
  algorithm?: KryptosSigAlgorithm | "none";
};

/**
 * The MINT half of a profile's policy enforcement:
 *
 *   1. `profile.rules` + `profile.validate` — the shared structural policy
 *      (`applyProfilePolicy`), which the verify floor runs too,
 *   2. the crypto floor (`profile.algClass` via `algPermitted`), folded into the
 *      same failure list so one bad mint reports every reason at once.
 *
 * Throws `profile_policy_invalid`.
 */
export const validateProfileClaims = (
  profile: TokenProfile,
  claims: Dict,
  ctx: SignContext & ValidateProfileContext = {},
): void => {
  const invalid: Array<InvalidEntry> = [...applyProfilePolicy(profile, claims, ctx)];

  if (profile.algClass) {
    invalid.push(...algPermitted(ctx.algorithm, profile.algClass));
  }

  if (invalid.length > 0) {
    throw new AegisDomainError("Invalid token", {
      code: "profile_policy_invalid",
      data: { invalid },
      debug: { invalid, profile: profile.name },
      title: "Profile Policy Invalid",
      details: "The assembled claims do not satisfy the profile's RFC validation rules.",
    });
  }
};
