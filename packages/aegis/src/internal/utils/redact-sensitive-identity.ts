import type { Dict } from "@lindorm/types";
import { FILTERED, sanitiseToken } from "@lindorm/utils";

// The identity numbers themselves — a personnummer / CPR / SSN — are the only
// values that must never reach a log. The paired `*_verified` booleans are what
// you debug an assurance decision against, so they stay. Both the FLAT wire
// names and the camelCase domain names are covered so a payload logged in either
// form is filtered.
const NUMBER_KEYS = [
  "nationalIdentityNumber",
  "national_identity_number",
  "socialSecurityNumber",
  "social_security_number",
];

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
