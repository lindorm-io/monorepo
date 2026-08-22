import type { GrantType, Scope } from "@lindorm/openid";
import type {
  AuthenticatorAssuranceLevel,
  FederationAssuranceLevel,
  IdentityAssuranceLevel,
  LevelOfAssurance,
} from "./level-of-assurance.js";

/**
 * The RESOLVED (primary) authentication factor of the session — a SINGLE value,
 * the strongest posture the authentication achieved:
 *   - `"1fa"`   one factor only.
 *   - `"2fa"`   two factors from distinct categories.
 *   - `"phr"`   phishing-resistant (e.g. WebAuthn/FIDO2).
 *   - `"phrh"`  phishing-resistant AND hardware-bound (a roaming authenticator).
 * Open (`string & {}`) on purpose: aegis is a generic JWT library and must
 * represent whatever arrived on the wire. The closed set is enforced downstream.
 */
export type AuthFactorReference = "1fa" | "2fa" | "phr" | "phrh" | (string & {});

/**
 * The authentication factor CATEGORIES the session exercised (PSD2 SCA axes) —
 * an array, one entry per distinct category:
 *   - `"knowledge"`   something the subject knows (password, PIN).
 *   - `"possession"`  something the subject has (device, token, phone).
 *   - `"inherence"`   something the subject is (biometrics).
 * Open (`string & {}`) for the same reason as {@link AuthFactorReference}.
 */
export type AuthFactorCategory = "knowledge" | "possession" | "inherence" | (string & {});

export type SessionHint =
  | "web"
  | "mobile"
  | "cli"
  | "service"
  | "machine"
  | (string & {});

export type SubjectHint = "user" | "client" | "service" | "device" | (string & {});

// Lindorm domain claims, domain form. This holds two distinct categories:
//  - standards-based assurance axes (loa/aal/ial/fal — ISO 29115 / NIST 800-63)
//    which have a standard meaning but no IANA-registered integer label, and
//  - genuinely lindorm-proprietary hints (authFactorReference/
//    authFactorCategories/sessionHint/subjectHint/tenantId) that are stripped
//    from off-platform tokens.
export type LindormClaims = {
  authenticatorAssuranceLevel?: AuthenticatorAssuranceLevel;
  authFactorCategories?: Array<AuthFactorCategory>;
  authFactorReference?: AuthFactorReference;
  clientId?: string;
  // The profiles this token's posture clears above the `permissive` floor
  // (RS-facing signal). Pruned when empty — `claims-registry.ts`, `conformsTo`.
  conformsTo?: Array<string>;
  federationAssuranceLevel?: FederationAssuranceLevel;
  // Aegis parses tokens it did not mint, and grant types are extensible
  // (RFC 6749 §8.3). The openid `GrantType` set is CLOSED on purpose,
  // so the extender widens here; the wire form (`gty?: string`) says the same.
  grantType?: GrantType | (string & {});
  identityAssuranceLevel?: IdentityAssuranceLevel;
  levelOfAssurance?: LevelOfAssurance;
  permissions?: Array<string>;
  // Aegis parses tokens it did not mint, and scope values are deployment-defined
  // (RFC 6749 §3.3). The openid `Scope` set is CLOSED on purpose,
  // so the extender widens here; the wire form (`scope?: Array<string> |
  // string`) says the same.
  scope?: Array<Scope | (string & {})>;
  sessionHint?: SessionHint;
  sessionId?: string;
  subjectHint?: SubjectHint;
  tenantId?: string;
};
