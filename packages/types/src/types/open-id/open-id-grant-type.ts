export type OpenIdGrantType =
  // oauth2 authorization code (RFC 6749)
  | "authorization_code"
  // oauth2 client credentials (RFC 6749)
  | "client_credentials"
  // oauth2 password (RFC 6749)
  | "password"
  // oauth2 refresh token (RFC 6749)
  | "refresh_token"

  // device authorization (RFC 8628)
  | "urn:ietf:params:oauth:grant-type:device_code"
  // token exchange (RFC 8693)
  | "urn:ietf:params:oauth:grant-type:token-exchange"
  // jwt bearer (RFC 7523)
  | "urn:ietf:params:oauth:grant-type:jwt-bearer"
  // saml2 bearer (RFC 7522)
  | "urn:ietf:params:oauth:grant-type:saml2-bearer"
  // backchannel authentication (OpenID CIBA Core 1.0)
  | "urn:openid:params:grant-type:ciba"

  // extension / vendor grant types
  | (string & {});
