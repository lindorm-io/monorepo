import type { Condition } from "@lindorm/match";
import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { ValidateJwtOptions } from "../../types/index.js";
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
 */
export const createJwtValidate = (validate: ValidateJwtOptions): Condition<Dict> => {
  const algorithm = validate.algorithm;
  const predicate: Condition<Dict> = {};

  for (const [key, value] of Object.entries(validate)) {
    if (key === "algorithm") continue;

    const hashDomain = HASH_MATCHERS[key];

    if (hashDomain && algorithm && isString(value)) {
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
