export interface OAuthTokenResponseData {
  // default
  accessToken: string;
  expiresIn: number;
  idToken: string;
  refreshToken: string;
  scope: Array<string>;
  tokenType: string;
}
