import type {
  AuthenticatorAssuranceLevel,
  FederationAssuranceLevel,
  IdentityAssuranceLevel,
  LevelOfAssurance,
} from "../domain/level-of-assurance.js";
import type {
  AuthFactorCategory,
  AuthFactorReference,
  SessionHint,
  SubjectHint,
} from "../domain/lindorm-claims.js";

// Wire form of LindormClaims — the standards-based assurance axes
// (loa/aal/ial/fal) and the lindorm-proprietary hints. `roles` lives on
// OAuthClaimsWire (RFC 9068), not here.
export type LindormClaimsWire = {
  aal?: AuthenticatorAssuranceLevel; // authenticator assurance level (NIST 800-63B)
  afc?: Array<AuthFactorCategory>; // auth factor categories (PSD2 SCA axes)
  afr?: AuthFactorReference; // resolved (primary) auth factor reference
  client_id?: string; // client id
  conforms_to?: Array<string>; // profiles the token's posture clears (RS-facing)
  fal?: FederationAssuranceLevel; // federation assurance level (NIST 800-63C)
  gty?: string; // grant type
  ial?: IdentityAssuranceLevel; // identity assurance level (NIST 800-63A)
  loa?: LevelOfAssurance; // level of assurance (ISO/IEC 29115)
  permissions?: Array<string>; // permissions
  scope?: Array<string> | string; // scope(s)
  sid?: string; // session id
  sih?: SessionHint; // session hint
  suh?: SubjectHint; // subject hint
  tenant_id?: string; // tenant id
};
