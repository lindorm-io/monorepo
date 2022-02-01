import { GrantType } from "../common";

export interface OAuthTokenRequestData {
  // default
  clientId?: string;
  clientSecret?: string;
  code: string;
  codeVerifier: string;
  grantType: GrantType;
  redirectUri: string;
  scope: string;

  // refresh
  refreshToken: string;
}

export interface OAuthTokenResponseBody {
  // default
  accessToken: string;
  expiresIn: number;
  idToken: string;
  refreshToken: string;
  scope: Array<string>;
  tokenType: string;
}
