import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { DomainAssert } from "../../types/index.js";
import { claimByDomain } from "../claims/claims-registry.js";
import { liftClaimMatcher } from "./lift-claim-matcher.js";

/**
 * Assert matcher builder — the flat-dict twin of `createIdentityMatchers`. It
 * keys the predicate by the DOMAIN claim name (the claims it matches are the
 * ones a caller already holds), where the verify half re-keys to the wire name
 * because it matches a wire payload. Same mechanism, different vocabulary; the
 * per-claim VALUE lift is shared, so the registry stays the only thing that
 * knows which claims are array-valued.
 *
 * There is no hash-DERIVE case here, and no `algorithm` to pass one: hashing a
 * raw source needs the token's signing algorithm, `alg` is a HEADER parameter
 * rather than a claim, and this surface is handed a flat claim dict. The verify
 * half owns those matchers because it is the half holding a key. A caller who
 * already has the digest matches it under its own domain name
 * (`accessTokenHash`/`codeHash`/`stateHash`) — an ordinary equality claim,
 * through the lift below like any other.
 *
 * `tokenType` needs no special case either: this surface matches a flat dict,
 * and a dict that carries a token's type carries it under exactly that key (an
 * RFC 7662 introspection response, a parsed credential). The verify half checks
 * the same assertion against the `typ` HEADER, because that is where a JWT/CWT
 * keeps it — one matcher, checked where each surface holds the answer.
 *
 * IDENTITY-ONLY, exactly like its verify twin: the temporal RANGE is a separate
 * builder, merged over this one by `createAssertPredicate` — the same division
 * `JwtKit.verify` makes on the wire side.
 */
export const createJwtValidate = (assert: DomainAssert): Condition<Dict> =>
  // ⛔ `Object.fromEntries`, NEVER `predicate[key] = operator`. The key is the
  // CALLER's — this door matches a flat dict a caller already holds — and
  // `liftClaimMatcher` answers `{ $eq: value }` for a string under any key,
  // including `__proto__`, whose registry lookup is a `Map` read and simply
  // misses. Assigned onto a plain object that hits `Object.prototype`'s setter
  // and swaps the prototype instead of defining the key, so the caller's
  // assertion is dropped and the token verifies unasserted. Same disposal
  // `internal/claims/prune-empty-claims.ts` uses, and pinned at
  // `jwt-validate.test.ts#a __proto__ assertion is CARRIED`.
  Object.fromEntries(
    Object.entries(assert).map(([key, value]) => {
      const operator = liftClaimMatcher(claimByDomain(key), value);

      if (operator !== undefined) return [key, operator];

      throw new AegisDomainError(`Unsupported value: ${value as any} for key: ${key}`, {
        code: "jwt_validate_unsupported_value",
        data: { key },
        title: "JWT Validate Unsupported Value",
        details:
          "A claim matcher value must be a string, number, array, or predicate object; this key was given an unsupported type.",
      });
    }),
  ) as Condition<Dict>;
