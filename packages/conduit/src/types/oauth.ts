export type OpenIdConfigurationResponse = {
  authorizationEndpoint: string;
  claimsSupported: Array<string>;
  codeChallengeMethodsSupported: Array<string>;
  deviceAuthorizationEndpoint: string;
  idTokenSigningAlgValuesSupported: Array<string>;
  issuer: string;
  jwksUri: string;
  mfaChallengeEndpoint: string;
  registrationEndpoint: string;
  requestParameterSupported: boolean;
  requestUriParameterSupported: boolean;
  responseModesSupported: Array<string>;
  responseTypesSupported: Array<string>;
  revocationEndpoint: string;
  scopesSupported: Array<string>;
  subjectTypesSupported: Array<string>;
  tokenEndpoint: string;
  tokenEndpointAuthMethodsSupported: Array<string>;
  tokenEndpointAuthSigningAlgValuesSupported: string;
  userinfoEndpoint: string;
};

export type OAuthTokenResponse = {
  accessToken: string;
  expiresIn: number;
  expiresOn: number;
  idToken: string | undefined;
  refreshToken: string | undefined;
  scope: Array<string> | string | undefined;
  tokenType: string;
};
