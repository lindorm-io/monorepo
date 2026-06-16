import type { OpenIdGrantType, OpenIdScope } from "@lindorm/types";
import type {
  AuthenticatorAssuranceLevel,
  FederationAssuranceLevel,
  IdentityAssuranceLevel,
  LevelOfAssurance,
} from "../level-of-assurance.js";

export type AuthFactor = "knowledge" | "possession" | "inherence" | (string & {});

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
//  - genuinely lindorm-proprietary hints (authFactor/sessionHint/subjectHint/
//    tenantId) that are stripped from off-platform tokens.
export type LindormClaims = {
  authenticatorAssuranceLevel?: AuthenticatorAssuranceLevel;
  authFactor?: Array<AuthFactor>;
  clientId?: string;
  federationAssuranceLevel?: FederationAssuranceLevel;
  grantType?: OpenIdGrantType;
  identityAssuranceLevel?: IdentityAssuranceLevel;
  levelOfAssurance?: LevelOfAssurance;
  permissions?: Array<string>;
  scope?: Array<OpenIdScope>;
  sessionHint?: SessionHint;
  sessionId?: string;
  subjectHint?: SubjectHint;
  tenantId?: string;
};
