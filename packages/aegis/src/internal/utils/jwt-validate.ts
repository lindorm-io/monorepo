import type { Condition } from "@lindorm/match";
import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { ValidateJwtOptions } from "../../types/index.js";
import { claimByDomain } from "../claims/claims-registry.js";
import { createAccessTokenHash, createCodeHash, createStateHash } from "./create-hash.js";
import { liftClaimMatcher } from "./lift-claim-matcher.js";

/**
 * Assert matcher builder — the flat-dict twin of `createIdentityMatchers`. It
 * keys the predicate by the caller's OWN key (the claims it matches are domain
 * -keyed), where the verify half re-keys to the wire name; the per-claim VALUE
 * lift is shared, so the registry stays the only thing that knows which claims
 * are array-valued.
 *
 * The hash-derive inputs (`accessToken`/`authCode`/`authState` → `at_hash`/
 * `c_hash`/`s_hash`) are assert-only and resolve BEFORE the lift: they name a
 * SOURCE value that is hashed with `algorithm`, not a claim value to match.
 */
export const createJwtValidate = (validate: ValidateJwtOptions): Condition<Dict> => {
  const algorithm = validate.algorithm;
  const predicate: Condition<Dict> = {};

  for (const [key, value] of Object.entries(validate)) {
    if (key === "algorithm") continue;

    if (key === "accessToken" && algorithm && isString(value)) {
      predicate[key] = { $eq: createAccessTokenHash(algorithm, value) };
      continue;
    }
    if (key === "authCode" && algorithm && isString(value)) {
      predicate[key] = { $eq: createCodeHash(algorithm, value) };
      continue;
    }
    if (key === "authState" && algorithm && isString(value)) {
      predicate[key] = { $eq: createStateHash(algorithm, value) };
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
