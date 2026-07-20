import type { ProfileClaimName, TokenProfile } from "../../types/index.js";

/**
 * Identity factory that CAPTURES a profile's literal `required` tuple in the
 * type while checking every other field against {@link TokenProfile}. The
 * `const` type parameter preserves the exact `required: readonly [...]` tuple
 * (no `as const` needed at the call site), which the verify overloads read to
 * narrow profile-guaranteed claims to non-optional. Runtime is pure identity.
 */
export const defineProfile = <const R extends ReadonlyArray<ProfileClaimName>>(
  profile: TokenProfile<R>,
): TokenProfile<R> => profile;
