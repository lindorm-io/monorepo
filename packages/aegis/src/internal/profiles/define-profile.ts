import type {
  ProfileClaimName,
  TokenProfile,
  TokenProfileInput,
} from "../../types/index.js";

/**
 * Identity-shaped factory that CAPTURES a profile's literal `required` tuple in
 * the type while checking every other field against {@link TokenProfile}. The
 * `const` type parameter preserves the exact `required: readonly [...]` tuple
 * (no `as const` needed at the call site), which the verify overloads read to
 * narrow profile-guaranteed claims to non-optional.
 *
 * It is the ONE place a profile's optional authoring sugar is resolved: `use`
 * defaults to `"both"` HERE, so every consumer reads a fully-resolved
 * descriptor and none of them re-derives the default. `registerProfile` runs a
 * runtime-registered profile through the same call for the same reason.
 */
export const defineProfile = <const R extends ReadonlyArray<ProfileClaimName>>(
  profile: TokenProfileInput<R>,
): TokenProfile<R> => ({ ...profile, use: profile.use ?? "both" });
