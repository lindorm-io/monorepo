import { OauthGrantType } from "../../../oauth";

export type TokenRequestBody = {
  // default
  clientId?: string;
  clientSecret?: string;
  code: string;
  codeVerifier: string;
  grantType: OauthGrantType;
  redirectUri: string;
  scope: string;

  // refresh
  refreshToken: string;
};

export type TokenResponse = {
  accessToken: string;
  expiresIn: number;
  idToken: string;
  refreshToken: string;
  scope: Array<string>;
  tokenType: string;
};
