import { AdjustedAccessLevel, LevelOfAssurance } from "../../level-of-assurance";
import { AuthFactor, SessionHint, SubjectHint } from "../lindorm-claims";

// Wire form of LindormClaims — proprietary lindorm-only claims that do
// not have a corresponding standard. `roles` lives on OAuthClaimsWire
// (RFC 9068), not here.
export type LindormClaimsWire = {
  aal?: AdjustedAccessLevel; // adjusted access level
  afr?: Array<AuthFactor>; // auth factor references
  client_id?: string; // client id
  gty?: string; // grant type
  loa?: LevelOfAssurance; // level of assurance
  permissions?: Array<string>; // permissions
  scope?: Array<string> | string; // scope(s)
  sid?: string; // session id
  sih?: SessionHint; // session hint
  suh?: SubjectHint; // subject hint
  tenant_id?: string; // tenant id
};
