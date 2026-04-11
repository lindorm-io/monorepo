// https://openid.net/specs/openid-connect-core-1_0.html#IDToken
export type OidcClaimsWire = {
  acr?: string; // authentication context class reference
  amr?: Array<string>; // authentication methods references
  at_hash?: string; // access token hash
  auth_time?: number; // authentication time
  azp?: string; // authorized party
  c_hash?: string; // code hash
  nonce?: string; // nonce
  s_hash?: string; // state hash
};
