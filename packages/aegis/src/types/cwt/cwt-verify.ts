import type { AegisVerifyKey } from "../aegis.js";
import type { JwtClaimMatchers } from "../jwt/jwt-claim-matchers.js";

/**
 * Options for the generic `cwt.verify`. The standard-claim matchers (issuer,
 * audience, subject, …) plus the key policy — the same matchers the JWT path
 * consumes, applied to the decoded CWT claims exactly as `jwt.verify` applies
 * them to a JWT.
 */
export type VerifyCwtOptions = JwtClaimMatchers & {
  /**
   * Per-call verification key policy — a CHECK on the key the CWT's `kid` names.
   * Consumed by `Aegis`, which resolves the key by kid.
   */
  key?: AegisVerifyKey;
  /**
   * `exp` claim presence policy (default `"required"`). `"required"` rejects an
   * exp-less CWT; `"optional"` accepts an absent exp (RFC 8392 makes exp
   * optional). When exp IS present its value is always range-checked (with clock
   * tolerance) regardless of this option.
   */
  expPresence?: "required" | "optional";
};
