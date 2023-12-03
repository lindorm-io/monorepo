export enum OpenIdGrantType {
  AUTHENTICATION_TOKEN = "urn:ietf:params:oauth:grant-type:authentication-token",
  AUTHORIZATION_CODE = "urn:ietf:params:oauth:grant-type:authorization-code",
  BACKCHANNEL_AUTHENTICATION = "urn:openid:params:grant-type:ciba",
  CLIENT_CREDENTIALS = "urn:ietf:params:oauth:grant-type:client-credentials",
  JWT_BEARER = "urn:ietf:params:oauth:grant-type:jwt-bearer",
  PASSWORD = "urn:ietf:params:oauth:grant-type:password",
  REFRESH_TOKEN = "urn:ietf:params:oauth:grant-type:refresh-token",
  TOKEN_EXCHANGE = "urn:ietf:params:oauth:grant-type:token-exchange",

  OAUTH2_AUTHORIZATION_CODE = "authorization_code",
  OAUTH2_CLIENT_CREDENTIALS = "client_credentials",
  OAUTH2_PASSWORD = "password",
  OAUTH2_REFRESH_TOKEN = "refresh_token",
}
