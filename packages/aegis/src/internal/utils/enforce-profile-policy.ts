import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { InvalidEntry, SignContext, TokenProfile } from "../../types/index.js";

/**
 * Enforce a profile's presence/forbid/atLeastOneOf/requiredWhen policy on the
 * DOMAIN-keyed common claims layer (profile arrays are domain-named). The
 * structural RFC rules run separately via `validateProfileClaims`. Lifted out of
 * `build-profile-claims.ts` so `assemble-common-claims.ts` can own the policy
 * step without a module cycle.
 */
export const enforceProfilePolicy = (
  profile: TokenProfile,
  claims: Dict,
  ctx: SignContext,
): void => {
  const invalid: Array<InvalidEntry> = [];

  for (const key of profile.required) {
    if (claims[key] === undefined) {
      invalid.push({ key, message: `Required claim "${key}" is missing` });
    }
  }

  for (const key of profile.forbidden) {
    if (claims[key] !== undefined) {
      invalid.push({ key, message: `Forbidden claim "${key}" is present` });
    }
  }

  for (const group of profile.atLeastOneOf) {
    if (!group.some((key) => claims[key] !== undefined)) {
      invalid.push({
        key: group.join("|"),
        message: `At least one of [${group.join(", ")}] is required`,
      });
    }
  }

  for (const { claim, when } of profile.requiredWhen) {
    if (claims[claim] === undefined && when(claims, ctx)) {
      invalid.push({
        key: claim,
        message: `Conditionally required claim "${claim}" is missing`,
      });
    }
  }

  if (invalid.length > 0) {
    throw new AegisDomainError("Invalid token", {
      code: "jwt_claims_invalid",
      data: { invalid },
      debug: { invalid, profile: profile.name },
      title: "JWT Claims Invalid",
      details:
        "The assembled claims do not satisfy the profile's required/forbidden/conditional rules.",
    });
  }
};
