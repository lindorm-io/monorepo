import { AdjustedAccessLevel, LevelOfAssurance } from "../level-of-assurance";

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

type LindormClaims = {
  aal?: AdjustedAccessLevel; // adjusted access level
  afr?: string; // auth factor reference
  cid?: string; // client id
  gty?: string; // grant type
  loa?: LevelOfAssurance; // level of assurance
  per?: Array<string>; // permissions;
  rls?: Array<string> | string; // role(s)
  scope?: Array<string> | string; // scope(s)
  sid?: string; // session id
  sih?: string; // session hint
  suh?: string; // subject hint
  tid?: string; // tenant id
  token_type?: string;
};

export type JwtClaims = StdClaims & OidcClaims & LindormClaims;
