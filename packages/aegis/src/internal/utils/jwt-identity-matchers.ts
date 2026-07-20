import { subSeconds } from "@lindorm/date";
import { isArray, isNumber, isObject, isString } from "@lindorm/is";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { PredicateOperator } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { JwtClaims, VerifyJwtOptions } from "../../types/index.js";
import { claimByDomain } from "../claims/claims-registry.js";
import { createHash } from "./create-hash.js";

/**
 * The hash-DERIVE matchers — the ONLY matchers the registry can't resolve by a
 * name lookup. Each names a SOURCE value (the access token / code / state) that
 * is HASHED into its wire claim, so the option key ("accessToken") deliberately
 * differs from the registry domain ("accessTokenHash") and the value is computed,
 * not name-mapped. Every OTHER matcher key is a plain domain name the registry
 * owns, resolved via `specByDomain(key).jose`.
 */
const HASH_MATCHERS: Readonly<Record<string, { jose: keyof JwtClaims }>> = {
  accessToken: { jose: "at_hash" },
  authCode: { jose: "c_hash" },
  authState: { jose: "s_hash" },
};

/**
 * Identity/presence matcher builder (the AEGIS half — Phase 8 relocates this into
 * Aegis). Builds the named-claim matchers (`aud`/`iss`/`sub`/`nonce`/hashes/…)
 * from the verifier-supplied options, and layers the `exp` PRESENCE requiredness
 * on top of the temporal range (see `createTemporalMatchers`).
 *
 * `exp` PRESENCE is policy (default `"required"`). When required, the matcher
 * drops the `$exists: false` escape so a missing exp FAILS the predicate; when
 * optional an absent exp is tolerated (SSF SETs). The clock-tolerant lower bound
 * mirrors the temporal builder — when exp IS present its value is range-checked
 * either way. `iat`/`nbf`/`auth_time` keep their `$exists: false` unconditionally
 * (owned by the temporal builder) — those claims are genuinely optional.
 */
export const createIdentityMatchers = (
  algorithm: KryptosAlgorithm,
  verify: VerifyJwtOptions,
  clockTolerance: number,
): Partial<Record<keyof JwtClaims, PredicateOperator<any>>> => {
  const predicate: Partial<Record<keyof JwtClaims, PredicateOperator<any>>> = {};

  if (verify.expPresence !== "optional") {
    predicate.exp = { $gte: subSeconds(new Date(), clockTolerance) };
  }

  for (const [key, value] of Object.entries(verify)) {
    // tokenType is validated against the JOSE `typ` header by each Kit directly
    if (key === "tokenType") continue;
    // actor is validated against the parsed TokenDelegation by each Kit directly
    if (key === "actor") continue;
    // dpopProof is validated against the cnf.jkt claim by each Kit directly
    if (key === "dpopProof") continue;
    // trustBoundThumbprint is a binary flag consumed by each Kit directly
    if (key === "trustBoundThumbprint") continue;
    // typPresence governs the JOSE typ gate on the Aegis verify path directly
    if (key === "typPresence") continue;
    // expPresence governs the exp matcher above, not a per-claim equality check
    if (key === "expPresence") continue;
    // key is the key-selection policy, consumed by Aegis when it resolves the
    // verification key — not a claim matcher, and never present on the payload
    if (key === "key") continue;

    // The wire (JOSE) name comes from the registry — the single source of truth
    // for the domain->wire claim-name map. The three hash-derive matchers are the
    // sole exception (they compute a hash, not a name lookup). An unmapped key
    // has no claim to build a predicate for and throws (the exhaustive-mapping
    // throwing default the `mapVerify` switch used to provide).
    const hash = HASH_MATCHERS[key];
    const spec = claimByDomain(key);
    const mapped = hash?.jose ?? (spec?.jose as keyof JwtClaims | undefined);

    if (mapped === undefined) {
      throw new AegisDomainError(`Unsupported key: ${key} for JWT verification`, {
        code: "jwt_verify_unsupported_key",
        data: { key },
        title: "JWT Verify Unsupported Key",
        details:
          "A verify option key does not map to any known JWT claim, so no predicate can be built for it.",
      });
    }

    if (hash && isString(value)) {
      predicate[mapped] = { $eq: createHash(algorithm, value) };
      continue;
    }
    if (isArray<string>(value)) {
      predicate[mapped] = { $all: value };
      continue;
    }
    if (isNumber(value)) {
      predicate[mapped] = { $eq: value };
      continue;
    }
    if (isString(value)) {
      // The registry owns which claims are array-valued (`value: "array"`): for
      // those, a scalar verifier means "at least this one must be present", so
      // lift to a single-element $all rather than $eq (array ≠ string).
      if (spec?.value === "array") {
        predicate[mapped] = { $all: [value] };
        continue;
      }
      predicate[mapped] = { $eq: value };
      continue;
    }
    if (isObject(value)) {
      predicate[mapped] = value as PredicateOperator<any>;
      continue;
    }

    throw new AegisDomainError(`Unsupported value: ${value as any} for key: ${key}`, {
      code: "jwt_verify_unsupported_value",
      data: { key },
      title: "JWT Verify Unsupported Value",
      details:
        "A verify option value must be a string, number, array, or predicate object; this key was given an unsupported type.",
    });
  }

  return predicate;
};
