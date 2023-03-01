import { OpenIdGrantType } from "../../../../enums";

export type OpenIdConfigurationResponse = {
  authorizationEndpoint: string;
  backchannelLogoutSessionSupported: boolean;
  backchannelLogoutSupported: boolean;
  claimsParameterSupported: boolean;
  endSessionEndpoint: string;
  grantTypesSupported: Array<OpenIdGrantType>;
  idTokenEncryptionAlgValuesSupported: Array<string>;
  idTokenEncryptionEncValuesSupported: Array<string>;
  idTokenSigningAlgValuesSupported: Array<string>;
  issuer: string;
  jwksUri: string;
  logoutEndpoint: string;
  requestParameterSupported: boolean;
  requestUriParameterSupported: boolean;
  responseTypesSupported: Array<string>;
  revokeEndpoint: string;
  claimsSupported: Array<string>;
  scopesSupported: Array<string>;
  subjectTypesSupported: Array<string>;
  tokenEndpoint: string;
  tokenEndpointAuthMethodsSupported: Array<string>;
  tokenEndpointAuthSigningAlgValuesSupported: Array<string>;
  tokeninfoEndpoint: string;
  userinfoEndpoint: string;
};
