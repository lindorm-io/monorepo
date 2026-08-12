import type { PolicyRule, TokenProfile, TokenProfileInput } from "../../types/index.js";

/**
 * Identity-shaped factory that CAPTURES a profile's literal policy tuple in the
 * type while checking every other field against {@link TokenProfile}. The
 * `const` type parameter preserves the exact `policy: readonly [...]` tuple (no
 * `as const` needed at the call site), which the verify overloads read — through
 * the tuple's `required` rules — to narrow profile-guaranteed claims to
 * non-optional.
 *
 * It is the ONE place a profile's optional authoring sugar is resolved: `use`
 * defaults to `"both"` HERE, so every consumer reads a fully-resolved
 * descriptor and none of them re-derives the default. `registerProfile` runs a
 * runtime-registered profile through the same call for the same reason.
 */
export const defineProfile = <const P extends ReadonlyArray<PolicyRule>>(
  profile: TokenProfileInput<P>,
): TokenProfile<P> => ({ ...profile, use: profile.use ?? "both" });
