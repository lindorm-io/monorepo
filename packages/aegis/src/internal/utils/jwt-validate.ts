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
 * There is no hash-DERIVE case here and no `algorithm` to pass one: hashing a raw
 * source needs the token's signing algorithm, and this surface is handed a flat
 * claim dict. A caller holding the digest matches it under its own domain name
 * (`accessTokenHash`/`codeHash`/`stateHash`) as an ordinary equality claim.
 *
 * `tokenType` needs no special case either: a flat dict carries a token's type
 * under exactly that key (an RFC 7662 introspection response, a parsed
 * credential), where the verify half checks the same assertion against the `typ`
 * HEADER.
 *
 * IDENTITY-ONLY, like its verify twin: the temporal RANGE is a separate builder,
 * merged over this one by `createAssertPredicate`.
 */
export const createJwtValidate = (assert: DomainAssert): Condition<Dict> =>
  // ⛔ `Object.fromEntries`, NEVER `predicate[key] = operator`. The key is the
  // CALLER's, and `liftClaimMatcher` answers `{ $eq: value }` for a string under
  // any key, `__proto__` included. Assigned onto a plain object it hits
  // `Object.prototype`'s setter and swaps the prototype instead of defining the
  // key, so the assertion is dropped and the token verifies unasserted. Pinned at
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
