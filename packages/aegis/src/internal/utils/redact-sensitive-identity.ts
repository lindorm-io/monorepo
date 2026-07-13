import { isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { FILTERED, sanitiseToken } from "@lindorm/utils";

// The identity numbers themselves — a personnummer / CPR / SSN — are the only
// values here that must never reach a log. The paired `*_verified` booleans are
// what you debug an assurance decision against, so they stay.
const NUMBER_KEYS = [
  "nationalIdentityNumber",
  "national_identity_number",
  "socialSecurityNumber",
  "social_security_number",
];

const redactIdentity = (identity: unknown): unknown => {
  if (!isObject(identity)) return identity;

  const result: Dict = { ...identity };

  for (const key of NUMBER_KEYS) {
    if (result[key] != null) result[key] = FILTERED;
  }

  return result;
};

/**
 * Redacts the mint-side payloads aegis logs at debug.
 *
 * `sensitive_identity` carries government-issued identifiers, and aegis refuses to put
 * them on the wire in clear — it forces encryption, and omits the claim outright when no
 * recipient key resolves. Logging the very same numbers in cleartext would walk straight
 * around that guarantee, so they are filtered here too. Handles both the domain shape
 * (`sensitiveIdentity`) and the wire shape (`sensitive_identity`).
 *
 * Everything else stays: the remaining claims are the ones already visible in a logged
 * token's payload, and redacting them would cost debuggability for nothing.
 */
export const redactSensitiveIdentity = <T extends Dict>(payload: T): T => {
  const domain = payload.sensitiveIdentity;
  const wire = payload.sensitive_identity;

  if (domain == null && wire == null) return payload;

  return {
    ...payload,
    ...(domain != null ? { sensitiveIdentity: redactIdentity(domain) } : {}),
    ...(wire != null ? { sensitive_identity: redactIdentity(wire) } : {}),
  };
};

/**
 * Redacts a DPoP proof carried on verify options — the proof is itself a whole token.
 */
export const redactVerifyOptions = <T extends Dict>(options: T): T =>
  options.dpopProof !== undefined
    ? { ...options, dpopProof: sanitiseToken(options.dpopProof) }
    : options;
