import type { ConditionOperator } from "@lindorm/match";
import { isString } from "@lindorm/is";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { AegisClaimsWire } from "../../types/index.js";
import { claimByDomain } from "../claims/claims-registry.js";
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
 * (named-8 + folded-14 equality claims) merged with the three hash-derive inputs
 * (`accessToken`/`authCode`/`authState`) lifted from verify OPTIONS. It carries
 * no verify knobs (those never reach here), so there is nothing to skip; every
 * key maps to a JOSE claim via the registry (or the hash table).
 */
export const createIdentityMatchers = (
  algorithm: KryptosAlgorithm,
  matchers: Dict,
): Partial<Record<keyof AegisClaimsWire, ConditionOperator<any>>> => {
  const predicate: Partial<Record<keyof AegisClaimsWire, ConditionOperator<any>>> = {};

  for (const [key, value] of Object.entries(matchers)) {
    // The wire (JOSE) name comes from the registry — the single source of truth
    // for the domain->wire claim-name map. The three hash-derive matchers are the
    // sole exception (they compute a hash, not a name lookup). An unmapped key
    // has no claim to build a predicate for and throws (the exhaustive-mapping
    // throwing default the `mapVerify` switch used to provide).
    const hashDomain = HASH_MATCHERS[key];
    const spec = claimByDomain(key);
    const mapped = (hashDomain ? claimByDomain(hashDomain)?.jose : spec?.jose) as
      | keyof AegisClaimsWire
      | undefined;

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
