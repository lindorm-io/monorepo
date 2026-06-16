import type {
  AuthenticatorAssuranceLevel,
  FederationAssuranceLevel,
  IdentityAssuranceLevel,
  LevelOfAssurance,
} from "../../level-of-assurance.js";
import type { AuthFactor, SessionHint, SubjectHint } from "../lindorm-claims.js";

// Wire form of LindormClaims — the standards-based assurance axes
// (loa/aal/ial/fal) and the lindorm-proprietary hints. `roles` lives on
// OAuthClaimsWire (RFC 9068), not here.
export type LindormClaimsWire = {
  aal?: AuthenticatorAssuranceLevel; // authenticator assurance level (NIST 800-63B)
  afr?: Array<AuthFactor>; // auth factor references
  client_id?: string; // client id
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
