import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import type { AegisSensitive } from "../../types/index.js";
import { CLAIMS_REGISTRY } from "../claims/claims-registry.js";

// The DOMAIN names of the sensitive-category claims, DERIVED from the registry
// (`category: "sensitive"`) — the single source of truth, never a hand-kept list.
const SENSITIVE_DOMAINS: ReadonlyArray<string> = CLAIMS_REGISTRY.filter(
  (spec) => spec.category === "sensitive",
).map((spec) => spec.domain);

/**
 * Partition the sensitive-category claims off a DOMAIN-keyed claim dict. The
 * sensitive claims arrive FLAT and resolve into the domain layer like any other
 * registered claim; this collects them (camelCase domain names) and returns the
 * remaining claims with the sensitive keys removed.
 *
 * The gate that decides whether to SURFACE the collected object — OIDC Core
 * §13.3, only on an encrypted token — lives in the caller. `rest` always has the
 * sensitive keys stripped, so an unencrypted token that carried them in
 * cleartext leaks nothing regardless.
 */
export const extractSensitiveClaims = (
  domain: Dict,
): { sensitive: AegisSensitive | undefined; rest: Dict } => {
  const collected: Dict = {};
  const rest: Dict = { ...domain };

  for (const key of SENSITIVE_DOMAINS) {
    if (key in rest) {
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
