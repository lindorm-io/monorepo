import type { ConditionOperator } from "@lindorm/match";
import { isString } from "@lindorm/is";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import { claimByDomain, type NameSelector } from "../claims/claims-registry.js";
import { createHash } from "./create-hash.js";
import { HASH_MATCHERS } from "./hash-matchers.js";
import { liftClaimMatcher } from "./lift-claim-matcher.js";

/**
 * Identity matcher builder (the AEGIS half). Builds the wire-keyed named-claim
 * predicate (`aud`/`iss`/`sub`/`nonce`/hashes/…) from the resolved `assert`
 * matcher bag. IDENTITY-ONLY: it owns no temporal concern. The temporal RANGE
 * (exp/nbf/iat/auth_time, with clock tolerance and the per-claim skip flags)
 * is the kit's sole responsibility (`createTemporalMatchers`); `exp` PRESENCE is
 * a domain policy enforced separately (`expPresence`, at the verify sites).
 *
 * The input `matchers` is a CLEAN claim-matcher bag — the domain `assert`
 * (named-8 + folded-14 equality claims + the three hash-derive inputs
 * `accessToken`/`authCode`/`authState`), less `tokenType`, which asserts the
 * token's TYPE HEADER and is enforced by the caller before this builds. It
 * carries no verify knobs (those never reach here), so there is nothing to
 * skip; every key maps to a claim via the registry (or the hash table).
 *
 * `nameOf` picks the WIRE SPELLING, and it is REQUIRED rather than defaulted to
 * JOSE: the predicate this returns is applied to a wire-keyed dict, and the two
 * wires disagree about `tokenId` (`jti` vs `cti`). A default is precisely how the
 * COSE caller silently inherited JOSE keys — an exact match then rejected a
 * legitimate token, and `$exists: false` passed on a token that had one. Making
 * it explicit forces any new call site to answer the question.
 */
export const createIdentityMatchers = (
  algorithm: KryptosAlgorithm,
  matchers: Dict,
  nameOf: NameSelector,
): Record<string, ConditionOperator<any>> => {
  // String-keyed, not `keyof AegisClaimsWire`: the key space is whatever `nameOf`
  // yields, and the COSE selector produces `cti`, which is not a JOSE wire name.
  const predicate: Record<string, ConditionOperator<any>> = {};

  for (const [key, value] of Object.entries(matchers)) {
    // The wire name comes from the registry — the single source of truth for the
    // domain->wire claim-name map — spelled for the wire `nameOf` selects. The
    // three hash-derive matchers are the sole exception (they compute a hash, not
    // a name lookup). An unmapped key has no claim to build a predicate for and
    // throws (the exhaustive-mapping throwing default the `mapVerify` switch used
    // to provide).
    const hashDomain = HASH_MATCHERS[key];
    const spec = claimByDomain(key);
    const hashSpec = hashDomain ? claimByDomain(hashDomain) : undefined;
    const target = hashDomain ? hashSpec : spec;
    const mapped = target ? nameOf(target) : undefined;

    if (mapped === undefined) {
      throw new AegisDomainError(`Unsupported key: ${key} for JWT verification`, {
        code: "jwt_verify_unsupported_key",
        data: { key },
        title: "JWT Verify Unsupported Key",
        details:
          "A verify option key does not map to any known JWT claim, so no predicate can be built for it.",
      });
    }

    if (hashDomain && isString(value)) {
      predicate[mapped] = { $eq: createHash(algorithm, value) };
      continue;
    }

    // The VALUE lift is shared with the assert path (`createJwtValidate`) — the
    // registry is the single owner of which claims are array-valued, so a scalar
    // matcher for one lifts to a single-element $all there exactly as here.
    const operator = liftClaimMatcher(spec, value);

    if (operator !== undefined) {
      predicate[mapped] = operator;
      continue;
    }

    throw new AegisDomainError(`Unsupported value: ${value} for key: ${key}`, {
      code: "jwt_verify_unsupported_value",
      data: { key },
      title: "JWT Verify Unsupported Value",
      details:
        "A verify option value must be a string, number, array, or predicate object; this key was given an unsupported type.",
    });
  }

  return predicate;
};
