import { AesEncryption } from "../aes-encryption";
import { JwksEncryptionAlgorithm, JwksSigningAlgorithm } from "../jwks";
import { OpenIdBackchannelTokenDeliveryMode } from "./open-id-backchannel-token-delivery-mode";
import { OpenIdClaims } from "./open-id-claims";
import { OpenIdDisplayMode } from "./open-id-display-mode";
import { OpenIdGrantType } from "./open-id-grant-type";
import { OpenIdResponseType } from "./open-id-response-type";
import { OpenIdScope } from "./open-id-scope";
import { OpenIdSubjectType } from "./open-id-subject-type";
import { OpenIdTokenAuthMethod } from "./open-id-token-auth-method";
import { OpenIdTokenHeaderType } from "./open-id-token-header-type";

type LindormConfiguration = {
  rightToBeForgottenEndpoint: string;
  tokenExchangeEndpoint: string;
};

type ExternalConfiguration = {
  deviceAuthorizationEndpoint: string;
  mfaChallengeEndpoint: string;
};

type StandardConfiguration = {
  acrValuesSupported: Array<string>;
  authorizationEndpoint: string;
  backchannelAuthenticationEndpoint: string;
  backchannelAuthenticationRequestSigningAlgValuesSupported: [];
  backchannelLogoutSessionSupported: boolean;
  backchannelLogoutSupported: boolean;
  backchannelTokenDeliveryModesSupported: Array<OpenIdBackchannelTokenDeliveryMode>;
  backchannelUserCodeParameterSupported: boolean;
  claimsParameterSupported: boolean;
  claimsSupported: Array<keyof OpenIdClaims | string>;
  codeChallengeMethodsSupported: Array<string>;
  displayValuesSupported: Array<OpenIdDisplayMode>;
  endSessionEndpoint: string;
  grantTypesSupported: Array<OpenIdGrantType>;
  idTokenEncryptionAlgValuesSupported: Array<JwksEncryptionAlgorithm>;
  idTokenEncryptionEncValuesSupported: Array<AesEncryption>;
  idTokenSigningAlgValuesSupported: Array<JwksSigningAlgorithm>;
  introspectEndpoint: string;
  issuer: string;
  jwksUri: string;
  logoutEndpoint: string;
  opPolicyUri: string;
  opTosUri: string;
  registrationEndpoint: string;
  requestParameterSupported: boolean;
  requestUriParameterSupported: boolean;
  responseModesSupported: Array<string>;
  responseTypesSupported: Array<OpenIdResponseType>;
  revocationEndpoint: string;
  revokeEndpoint: string;
  scopesSupported: Array<OpenIdScope | string>;
  subjectTypesSupported: Array<OpenIdSubjectType>;
  tokenEndpoint: string;
  tokenEndpointAuthMethodsSupported: Array<OpenIdTokenAuthMethod>;
  tokenEndpointAuthSigningAlgValuesSupported: Array<JwksSigningAlgorithm>;
  tokenHeaderTypesSupported: Array<OpenIdTokenHeaderType>;
  userinfoEndpoint: string;
};

export type OpenIdConfiguration = LindormConfiguration &
  ExternalConfiguration &
  StandardConfiguration;

export type OpenIdConfigurationResponse = OpenIdConfiguration;
