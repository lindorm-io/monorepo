export type OpenIdTokenClaims = {
  acr?: Array<string>; // authentication context class reference
  amr?: Array<string>; // authentication methods reference
  auth_time?: number; // time when authentication was performed
  azp?: string; // authorized party
  nonce?: string;
  sid?: string; // session id
  token_type: string;
  usr?: string; // username
};
