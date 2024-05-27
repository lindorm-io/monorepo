export type OpenIdGrantType =
  // authentication token
  | "urn:ietf:params:oauth:grant-type:authentication-token"
  // authorization code
  | "urn:ietf:params:oauth:grant-type:authorization-code"
  // backchannel authentication
  | "urn:openid:params:grant-type:ciba"
  // client credentials
  | "urn:ietf:params:oauth:grant-type:client-credentials"
  // jwt bearer
  | "urn:ietf:params:oauth:grant-type:jwt-bearer"
  // password
  | "urn:ietf:params:oauth:grant-type:password"
  // refresh token
  | "urn:ietf:params:oauth:grant-type:refresh-token"
  // token exchange
  | "urn:ietf:params:oauth:grant-type:token-exchange"

  // oauth2 authorization code (short)
  | "authorization_code"
  // oauth2 client credentials (short)
  | "client_credentials"
  // oauth2 password (short)
  | "password"
  // oauth2 refresh token (short)
  | "refresh_token";
