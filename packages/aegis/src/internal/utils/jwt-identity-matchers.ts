import type { Condition } from "@lindorm/match";
import { isString } from "@lindorm/is";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import { claimByDomain, type NameSelector } from "../claims/claims-registry.js";
import { buildCondition } from "./build-condition.js";
import { createHash } from "./create-hash.js";
import { HASH_MATCHERS } from "./hash-matchers.js";
import { liftClaimMatcher } from "./lift-claim-matcher.js";
import { matcherWireName } from "./matcher-wire-name.js";

/**
 * Identity matcher builder (the AEGIS half). Builds the wire-keyed named-claim
 * predicate (`aud`/`iss`/`sub`/`nonce`/hashes/…) from the resolved `assert`
 * matcher bag. IDENTITY-ONLY: it owns no temporal concern. The temporal RANGE
 * (exp/nbf/iat/auth_time, with clock tolerance and the per-claim skip flags)
 * is the kit's sole responsibility (`createTemporalMatchers`); `exp` PRESENCE is
 * a domain policy enforced separately (`expPresence`, at the verify sites).
 *
 * The input `matchers` is a CLEAN claim-matcher bag — the domain `assert` less
 * `tokenType`, which asserts the token's TYPE HEADER and is enforced by the caller
 * before this builds. It carries no verify knobs, so every claim key maps to a
 * claim via the registry or the hash table.
 *
 * The bag is a condition TREE (`buildCondition`): the root operators `$and` /
 * `$or` / `$not` are honoured at the root and nested, and every claim key inside
 * a branch is compiled exactly as one at the root — re-keyed to the wire name,
 * hash sources derived, the value lifted. The wire-name collision guard is
 * scoped to ONE condition object: a raw source and its digest claim in two
 * `$or` branches are two objects and do not collide.
 *
 * ⚠ `nameOf` picks the WIRE SPELLING and is REQUIRED, never defaulted to JOSE: the
 * predicate is applied to a wire-keyed dict and the two wires disagree about
 * `tokenId` (`jti` vs `cti`), so a default silently gives a COSE caller JOSE keys
 * — an exact match then rejects a legitimate token and `$exists: false` passes on
 * a token that has one.
 */
export const createIdentityMatchers = (
  algorithm: KryptosAlgorithm,
  matchers: Dict,
  nameOf: NameSelector,
): Condition<Dict> =>
  // String-keyed, not `keyof AegisClaimsWire`: the key space is whatever `nameOf`
  // yields, and the COSE selector produces `cti`, which is not a JOSE wire name.
  buildCondition(matchers, () => {
    // Which CALLER key claimed each wire name in THIS condition object. The
    // built object alone would answer THAT a name was taken but not BY WHAT, and
    // the refusal below has to name both spellings or it points the caller at a
    // key they did not write.
    const claimedBy = new Map<string, string>();

    return (key, value) => {
      // The wire name comes from `matcherWireName`, the same registry resolution
      // `applyVerifyPolicy` inverts to report a refusal in the caller's vocabulary.
      // The hash-derive matchers name a SOURCE value rather than a claim, so the
      // hash branch below still needs which domain claim they land in; an unmapped
      // key throws.
      // ⚠ `Object.hasOwn`, never a truthy index: `key` comes from the caller, and
      // `HASH_MATCHERS.toString` is inherited from the prototype and truthy.
      const hashDomain = Object.hasOwn(HASH_MATCHERS, key)
        ? HASH_MATCHERS[key]
        : undefined;
      const spec = claimByDomain(key);
      const mapped = matcherWireName(key, nameOf);

      if (mapped === undefined) {
        throw new AegisDomainError(`Unsupported key: ${key} for JWT verification`, {
          code: "jwt_verify_unsupported_key",
          data: { key },
          title: "JWT Verify Unsupported Key",
          details:
            "A verify option key does not map to any known JWT claim, so no predicate can be built for it.",
        });
      }

      // ⛔ TWO CALLER KEYS, ONE WIRE NAME. A raw hash SOURCE and its DIGEST claim
      // both resolve here (`accessToken` and `accessTokenHash` are both `at_hash`),
      // and one condition object carries one entry per wire name — so without
      // this the later key displaces the earlier one and the accept/reject
      // verdict turns on the order the caller happened to write them in.
      const collision = claimedBy.get(mapped);

      if (collision !== undefined) {
        throw new AegisDomainError(`Conflicting matchers for claim: ${mapped}`, {
          code: "jwt_verify_conflicting_matchers",
          data: { claim: mapped, keys: [collision, key] },
          title: "JWT Verify Conflicting Matchers",
          details:
            "Two verify option keys resolve to the same claim, so only one of them could be checked. State the raw source or the digest, never both.",
        });
      }

      claimedBy.set(mapped, key);

      // A hash-derive key takes ONLY a raw string: an operator bag here would fall
      // through to the value lift and be applied to the DIGEST claim unhashed.
      if (hashDomain !== undefined) {
        if (isString(value)) return [mapped, { $eq: createHash(algorithm, value) }];

        throw new AegisDomainError(`Unsupported value for key: ${key}`, {
          code: "jwt_verify_unsupported_value",
          data: { key },
          title: "JWT Verify Unsupported Value",
          details:
            "A verify option value for a raw hash source must be a string; this key was given an unsupported type.",
        });
      }

      // The VALUE lift is shared with the assert path (`createJwtValidate`) — the
      // registry is the single owner of which claims are array-valued, so a scalar
      // matcher for one lifts to a single-element $all there exactly as here.
      const operator = liftClaimMatcher(spec, value);

      if (operator !== undefined) return [mapped, operator];

      throw new AegisDomainError(`Unsupported value for key: ${key}`, {
        code: "jwt_verify_unsupported_value",
        data: { key },
        title: "JWT Verify Unsupported Value",
        details:
          "A verify option value must be a string, number, array, or predicate object; this key was given an unsupported type.",
      });
    };
  });
