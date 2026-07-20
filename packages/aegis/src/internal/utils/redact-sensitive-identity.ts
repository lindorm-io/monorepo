import type { Dict } from "@lindorm/types";
import { FILTERED, sanitiseToken } from "@lindorm/utils";
import { CLAIMS_REGISTRY } from "../claims/claims-registry.js";

// The identity numbers themselves — a personnummer / CPR / SSN — are the only
// values that must never reach a log. The paired `*_verified` booleans are what
// you debug an assurance decision against, so they stay. DERIVED from the claim
// registry: the sensitive-category claims whose VALUE is the number string
// (`value: "text"`) — the `*_verified` flags are `value: "bool"` and so fall
// out. Both the camelCase domain name and the FLAT JOSE wire name are covered so
// a payload logged in either form is filtered. A drift-guard test pins the
// derived set to the frozen key list.
const NUMBER_KEYS: ReadonlyArray<string> = CLAIMS_REGISTRY.filter(
  (spec) => spec.category === "sensitive" && spec.value === "text",
).flatMap((spec) => [spec.domain, spec.jose]);

/**
 * Redacts the mint-side payloads aegis logs at debug.
 *
 * The sensitive identity numbers travel as FLAT top-level claims, and aegis refuses to
 * put them on the wire in clear — it forces encryption, and omits them outright when no
 * recipient key resolves. Logging the very same numbers in cleartext would walk straight
 * around that guarantee, so they are filtered here too.
 *
 * Everything else stays: the remaining claims are the ones already visible in a logged
 * token's payload, and redacting them would cost debuggability for nothing.
 */
export const redactSensitiveIdentity = <T extends Dict>(payload: T): T => {
  if (!NUMBER_KEYS.some((key) => payload[key] != null)) return payload;

  const result: Dict = { ...payload };

  for (const key of NUMBER_KEYS) {
    if (result[key] != null) result[key] = FILTERED;
  }

  return result as T;
};

/**
 * Redacts a DPoP proof carried on verify options — the proof is itself a whole token.
 */
export const redactVerifyOptions = <T extends Dict>(options: T): T =>
  options.dpopProof !== undefined
    ? { ...options, dpopProof: sanitiseToken(options.dpopProof) }
    : options;
