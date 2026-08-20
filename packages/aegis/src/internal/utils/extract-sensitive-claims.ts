import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import type { AegisSensitive } from "../../types/index.js";
import { CLAIM_SPECS } from "../claims/claims-registry.js";

/**
 * The DOMAIN names of the sensitive claims, DERIVED from the registry
 * (`sensitivity: "sensitive"`) — the single source of truth, never a hand-kept
 * list. Sensitivity is its OWN column, independent of which read-side bucket the
 * claim lands in, so the confidentiality gate has one unambiguous input.
 *
 * Exported because the WRITE side needs the same answer: mint decides whether a
 * token must be encrypted from this list, not from which container the caller
 * happened to put the value in.
 */
export const SENSITIVE_DOMAINS: ReadonlyArray<string> = CLAIM_SPECS.filter(
  (spec) => spec.sensitivity === "sensitive",
).map((spec) => spec.domain);

/**
 * Partition the sensitive-category claims off a DOMAIN-keyed claim dict. The
 * sensitive claims arrive FLAT and resolve into the domain layer like any other
 * registered claim; this collects them (camelCase domain names) and returns the
 * remaining claims with the sensitive keys removed.
 *
 * The gate that decides whether to SURFACE the collected object — it fires only
 * on an encrypted token — lives in the caller. `rest` always has the sensitive
 * keys stripped, so an unencrypted token that carried them in cleartext leaks
 * nothing regardless.
 */
export const extractSensitiveClaims = (
  domain: Dict,
): { sensitive: AegisSensitive | undefined; rest: Dict } => {
  const collected: Dict = {};
  const rest: Dict = { ...domain };

  for (const key of SENSITIVE_DOMAINS) {
    // `Object.hasOwn`, never `in`. The keys here are registry-derived and closed,
    // so `in` would answer the same today — but `rest` is a caller-supplied claim
    // bag, and the day a registry `domain` name collides with an
    // `Object.prototype` member this loop would COLLECT A FUNCTION off the
    // prototype and surface it as a sensitive claim the caller never wrote. `in`
    // on a bag from outside is a BANNED construct in this package.
    if (Object.hasOwn(rest, key)) {
      collected[key] = rest[key];
      delete rest[key];
    }
  }

  const sensitive = omitUndefined(collected);

  return {
    sensitive:
      Object.keys(sensitive).length > 0 ? (sensitive as AegisSensitive) : undefined,
    rest,
  };
};
