import type { Condition } from "@lindorm/match";
import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { DomainAssert } from "../../types/index.js";
import { claimByDomain } from "../claims/claims-registry.js";
import { createHash } from "./create-hash.js";
import { HASH_MATCHERS } from "./hash-matchers.js";
import { liftClaimMatcher } from "./lift-claim-matcher.js";

/**
 * Assert matcher builder — the flat-dict twin of `createIdentityMatchers`. It
 * keys the predicate by the DOMAIN claim name (the claims it matches are the
 * ones a caller already holds), where the verify half re-keys to the wire name
 * because it matches a wire payload. Same mechanism, different vocabulary; the
 * per-claim VALUE lift is shared, so the registry stays the only thing that
 * knows which claims are array-valued.
 *
 * The hash-derive inputs resolve BEFORE the lift: they name a raw SOURCE value
 * (`accessToken`/`authCode`/`authState`) that is hashed with `algorithm` into
 * the claim mint wrote it to (`accessTokenHash`/`codeHash`/`stateHash`). A
 * caller holding the hash already can match it directly under that domain name —
 * it is an ordinary equality claim and needs no `algorithm`.
 *
 * A hash-derive input that cannot be hashed (a non-string source, or no
 * `algorithm`) THROWS rather than falling through to the lift: the lift would
 * key the predicate by the SOURCE name, which no claim set carries.
 *
 * `tokenType` needs no special case here: this surface matches a flat dict, and
 * a dict that carries a token's type carries it under exactly that key (an RFC
 * 7662 introspection response, a parsed credential). The verify half checks the
 * same assertion against the `typ` HEADER, because that is where a JWT/CWT keeps
 * it — one matcher, checked where each surface holds the answer.
 *
 * IDENTITY-ONLY, exactly like its verify twin: the temporal RANGE is a separate
 * builder, merged over this one by `createAssertPredicate` — the same division
 * `JwtKit.verify` makes on the wire side.
 */
export const createJwtValidate = (
  assert: DomainAssert,
  algorithm?: KryptosAlgorithm,
): Condition<Dict> => {
  const predicate: Condition<Dict> = {};

  for (const [key, value] of Object.entries(assert)) {
    const hashDomain = HASH_MATCHERS[key];

    if (hashDomain) {
      if (!isString(value)) {
        throw new AegisDomainError(
          `Unsupported value: ${value as any} for hash matcher: ${key}`,
          {
            code: "jwt_validate_unsupported_value",
            data: { key, claim: hashDomain },
            title: "JWT Validate Unsupported Value",
            details:
              "A hash-derive matcher names the RAW source value to hash, so it must be a string; an already-computed hash is matched under its own claim name instead.",
          },
        );
      }

      // The digest is tied to the token's signing algorithm (OIDC Core §3.1.3.6:
      // `…256` → SHA-256, `…384` → SHA-384, `…512` → SHA-512, left half), so it
      // cannot be defaulted — a fixed SHA-256 is PKCE's rule (RFC 7636 §4.2), a
      // different mechanism. Falling through instead wrote the predicate under
      // the SOURCE name (`accessToken`), which no claim set carries: a matcher
      // that fails closed but can never match, and never says why.
      if (algorithm === undefined) {
        throw new AegisDomainError(`Missing algorithm for hash matcher: ${key}`, {
          code: "jwt_validate_missing_algorithm",
          data: { key, claim: hashDomain },
          title: "JWT Validate Missing Algorithm",
          details:
            "A hash-derive matcher hashes its raw source with the token's signing algorithm, so `algorithm` must be supplied; match an already-computed hash under its own claim name instead.",
        });
      }

      predicate[hashDomain] = { $eq: createHash(algorithm, value) };
      continue;
    }

    const operator = liftClaimMatcher(claimByDomain(key), value);

    if (operator !== undefined) {
      predicate[key] = operator;
      continue;
    }

    throw new AegisDomainError(`Unsupported value: ${value as any} for key: ${key}`, {
      code: "jwt_validate_unsupported_value",
      data: { key },
      title: "JWT Validate Unsupported Value",
      details:
        "A claim matcher value must be a string, number, array, or predicate object; this key was given an unsupported type.",
    });
  }

  return predicate;
};
