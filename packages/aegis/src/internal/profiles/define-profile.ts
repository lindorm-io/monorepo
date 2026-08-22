import type { PolicyRule, TokenProfile, TokenProfileInput } from "../../types/index.js";

/**
 * Identity-shaped factory that CAPTURES a profile's literal policy tuple in the
 * type. The `const` type parameter preserves the exact `policy: readonly [...]`
 * tuple, which the verify overloads read — through its `required` rules — to
 * narrow profile-guaranteed claims to non-optional.
 *
 * ⚠ The ONE place a profile's optional authoring sugar is resolved: `use` defaults
 * to `"both"` HERE, so no consumer re-derives it. `registerProfile` runs a
 * runtime-registered profile through the same call.
 */
export const defineProfile = <const P extends ReadonlyArray<PolicyRule>>(
  profile: TokenProfileInput<P>,
): TokenProfile<P> => ({ ...profile, use: profile.use ?? "both" });
