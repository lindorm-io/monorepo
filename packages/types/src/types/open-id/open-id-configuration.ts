import type { AesEncryption } from "../aes-encryption.js";
import type { JwksEncryptionAlgorithm, JwksSigningAlgorithm } from "../jwks/index.js";
import type { OpenIdBackchannelTokenDeliveryMode } from "./open-id-backchannel-token-delivery-mode.js";
import type { OpenIdClaims } from "./open-id-claims.js";
import type { OpenIdDisplayMode } from "./open-id-display-mode.js";
import type { OpenIdGrantType } from "./open-id-grant-type.js";
import type { OpenIdResponseType } from "./open-id-response-type.js";
import type { OpenIdScope } from "./open-id-scope.js";
import type { OpenIdSubjectType } from "./open-id-subject-type.js";
import type { OpenIdTokenAuthMethod } from "./open-id-token-auth-method.js";
import type { OpenIdTokenHeaderType } from "./open-id-token-header-type.js";

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
