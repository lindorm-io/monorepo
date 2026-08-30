import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { DomainAssert } from "../../types/index.js";
import { claimByDomain } from "../claims/claims-registry.js";
import { buildCondition } from "./build-condition.js";
import { liftClaimMatcher } from "./lift-claim-matcher.js";

/**
 * Assert matcher builder — the flat-dict twin of `createIdentityMatchers`. It
 * keys the predicate by the DOMAIN claim name (the claims it matches are the
 * ones a caller already holds), where the verify half re-keys to the wire name
 * because it matches a wire payload. Same mechanism, different vocabulary; the
 * per-claim VALUE lift is shared, so the registry stays the only thing that
 * knows which claims are array-valued.
 *
 * The argument is a condition TREE (`buildCondition`): the root operators
 * `$and` / `$or` / `$not` are honoured at the root and nested, and every claim
 * key inside a branch takes the same value lift as one at the root. What an
 * operator means — an empty `$or`, a `$not` that is not an object — is
 * `@lindorm/match`'s to decide when the predicate is evaluated.
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
  buildCondition(assert, () => (key, value) => {
    const operator = liftClaimMatcher(claimByDomain(key), value);

    if (operator !== undefined) return [key, operator];

    throw new AegisDomainError(`Unsupported value: ${value as any} for key: ${key}`, {
      code: "jwt_validate_unsupported_value",
      data: { key },
      title: "JWT Validate Unsupported Value",
      details:
        "A claim matcher value must be a string, number, array, or predicate object; this key was given an unsupported type.",
    });
  });
