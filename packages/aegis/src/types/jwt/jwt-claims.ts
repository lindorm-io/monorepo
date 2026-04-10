import { AdjustedAccessLevel, LevelOfAssurance } from "../level-of-assurance";

export type AuthFactor = "knowledge" | "possession" | "inherence" | (string & {});

export type SessionHint =
  | "web"
  | "mobile"
  | "cli"
  | "service"
  | "machine"
  | (string & {});

export type SubjectHint = "user" | "client" | "service" | "device" | (string & {});

// https://datatracker.ietf.org/doc/html/rfc8693#section-4.1
export type ActClaim = {
  sub?: string;
  iss?: string;
  aud?: Array<string>;
  client_id?: string;
  act?: ActClaim;
};

// https://datatracker.ietf.org/doc/html/rfc7519#section-4.1
type StdClaims = {
  aud?: Array<string>; // audience
  exp?: number; // expires at
  iat?: number; // issued at
  iss?: string; // issuer
  jti?: string; // id
  nbf?: number; // not usable before
  sub?: string; // subject
};

// https://openid.net/specs/openid-connect-core-1_0.html#IDToken
type OidcClaims = {
  acr?: string; // authentication context class reference
  amr?: Array<string>; // authentication methods references
  at_hash?: string; // access token hash
  auth_time?: number; // authentication time
  azp?: string; // authorized party
  c_hash?: string; // code hash
  nonce?: string; // nonce
  s_hash?: string; // state hash
};

// https://datatracker.ietf.org/doc/html/rfc8693 (act, may_act)
// https://datatracker.ietf.org/doc/html/rfc9068#section-2.2.3.1 (groups, entitlements)
type ExtendedClaims = {
  act?: ActClaim; // delegation chain
  may_act?: ActClaim; // actor authorized to act on behalf of subject
  groups?: Array<string>; // groups
  entitlements?: Array<string>; // entitlements
};

type LindormClaims = {
  aal?: AdjustedAccessLevel; // adjusted access level
  afr?: Array<AuthFactor>; // auth factor references
  client_id?: string; // client id
  gty?: string; // grant type
  loa?: LevelOfAssurance; // level of assurance
  permissions?: Array<string>; // permissions
  roles?: Array<string> | string; // role(s)
  scope?: Array<string> | string; // scope(s)
  sid?: string; // session id
  sih?: SessionHint; // session hint
  suh?: SubjectHint; // subject hint
  tenant_id?: string; // tenant id
};

export type JwtClaims = StdClaims & OidcClaims & ExtendedClaims & LindormClaims;
