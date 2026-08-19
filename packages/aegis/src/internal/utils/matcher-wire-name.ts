import { claimByDomain, type NameSelector } from "../claims/claims-registry.js";
import { HASH_MATCHERS } from "./hash-matchers.js";

/**
 * ONE resolution, both directions: `createIdentityMatchers` keys its predicate by
 * this, and `applyVerifyPolicy` maps the failing predicate keys back to the
 * caller's vocabulary. A second copy would diverge on the hash matchers, whose
 * key (`accessToken`) is not the claim it lands in (`accessTokenHash`), and the
 * refusal would then name a key the caller never wrote.
 */
export const matcherWireName = (
  key: string,
  nameOf: NameSelector,
): string | undefined => {
  // ⚠ `Object.hasOwn`, never a truthy index: `key` comes from the caller, and
  // `HASH_MATCHERS.toString` is inherited from the prototype and truthy.
  const spec = claimByDomain(
    Object.hasOwn(HASH_MATCHERS, key) ? HASH_MATCHERS[key] : key,
  );

  return spec ? nameOf(spec) : undefined;
};
