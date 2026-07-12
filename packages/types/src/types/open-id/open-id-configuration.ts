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
  /**
   * OPTIONAL
   *
   * RFC 9396 §10 — Rich Authorization Requests metadata. A JSON
   * array containing the authorization details type values
   * supported by the Authorization Server. Clients use this
   * to discover which `authorization_details` `type` schemas
   * the AS recognizes.
   *
   * https://www.rfc-editor.org/rfc/rfc9396
   */
  authorizationDetailsTypesSupported?: Array<string>;
  /**
   * OPTIONAL
   *
   * JARM — JWT-Secured Authorization Response Mode. JWE `alg` values
   * supported for encrypting authorization response JWTs.
   *
   * https://openid.net/specs/oauth-v2-jarm.html
   */
  authorizationEncryptionAlgValuesSupported?: Array<JwksEncryptionAlgorithm>;
  /**
   * OPTIONAL
   *
   * JARM — JWT-Secured Authorization Response Mode. JWE `enc` values
   * supported for encrypting authorization response JWTs.
   *
   * https://openid.net/specs/oauth-v2-jarm.html
   */
  authorizationEncryptionEncValuesSupported?: Array<AesEncryption>;
  authorizationEndpoint: string;
  /**
   * OPTIONAL
   *
   * RFC 9207 — whether the authorization server includes the `iss`
   * parameter in authorization responses.
   *
   * https://www.rfc-editor.org/rfc/rfc9207
   */
  authorizationResponseIssParameterSupported?: boolean;
  /**
   * OPTIONAL
   *
   * JARM — JWT-Secured Authorization Response Mode. JWS `alg` values
   * supported for signing authorization response JWTs.
   *
   * https://openid.net/specs/oauth-v2-jarm.html
   */
  authorizationSigningAlgValuesSupported?: Array<JwksSigningAlgorithm>;
  backchannelAuthenticationEndpoint: string;
  backchannelAuthenticationRequestSigningAlgValuesSupported: Array<JwksSigningAlgorithm>;
  backchannelLogoutSessionSupported: boolean;
  backchannelLogoutSupported: boolean;
  backchannelTokenDeliveryModesSupported: Array<OpenIdBackchannelTokenDeliveryMode>;
  backchannelUserCodeParameterSupported: boolean;
  claimsParameterSupported: boolean;
  claimsSupported: Array<keyof OpenIdClaims | string>;
  codeChallengeMethodsSupported: Array<string>;
  displayValuesSupported: Array<OpenIdDisplayMode>;
  /**
   * OPTIONAL
   *
   * RFC 9449 §5.1 — DPoP. JWS `alg` values supported for DPoP
   * proof JWTs.
   *
   * https://www.rfc-editor.org/rfc/rfc9449
   */
  dpopSigningAlgValuesSupported?: Array<JwksSigningAlgorithm>;
  endSessionEndpoint: string;
  grantTypesSupported: Array<OpenIdGrantType>;
  idTokenEncryptionAlgValuesSupported: Array<JwksEncryptionAlgorithm>;
  idTokenEncryptionEncValuesSupported: Array<AesEncryption>;
  idTokenSigningAlgValuesSupported: Array<JwksSigningAlgorithm>;
  introspectEndpoint: string;
  /**
   * OPTIONAL
   *
   * RFC 9701 — JWT introspection responses. JWE `alg` values
   * supported for encrypting introspection response JWTs.
   *
   * https://www.rfc-editor.org/rfc/rfc9701
   */
  introspectionEncryptionAlgValuesSupported?: Array<JwksEncryptionAlgorithm>;
  /**
   * OPTIONAL
   *
   * RFC 9701 — JWT introspection responses. JWE `enc` values
   * supported for encrypting introspection response JWTs.
   *
   * https://www.rfc-editor.org/rfc/rfc9701
   */
  introspectionEncryptionEncValuesSupported?: Array<AesEncryption>;
  /**
   * OPTIONAL
   *
   * RFC 9701 — JWT introspection responses. JWS `alg` values
   * supported for signing introspection response JWTs.
   *
   * https://www.rfc-editor.org/rfc/rfc9701
   */
  introspectionSigningAlgValuesSupported?: Array<JwksSigningAlgorithm>;
  issuer: string;
  jwksUri: string;
  logoutEndpoint: string;
  opPolicyUri: string;
  opTosUri: string;
  /**
   * OPTIONAL
   *
   * RFC 9126 §5 — Pushed Authorization Requests. URL of the PAR
   * endpoint.
   *
   * https://www.rfc-editor.org/rfc/rfc9126
   */
  pushedAuthorizationRequestEndpoint?: string;
  registrationEndpoint: string;
  /**
   * OPTIONAL
   *
   * RFC 9101 — JWT-Secured Authorization Request (JAR). JWE `alg`
   * values supported for encrypting request objects.
   *
   * https://www.rfc-editor.org/rfc/rfc9101
   */
  requestObjectEncryptionAlgValuesSupported?: Array<JwksEncryptionAlgorithm>;
  /**
   * OPTIONAL
   *
   * RFC 9101 — JWT-Secured Authorization Request (JAR). JWE `enc`
   * values supported for encrypting request objects.
   *
   * https://www.rfc-editor.org/rfc/rfc9101
   */
  requestObjectEncryptionEncValuesSupported?: Array<AesEncryption>;
  /**
   * OPTIONAL
   *
   * RFC 9101 — JWT-Secured Authorization Request (JAR). JWS `alg`
   * values supported for signing request objects.
   *
   * https://www.rfc-editor.org/rfc/rfc9101
   */
  requestObjectSigningAlgValuesSupported?: Array<JwksSigningAlgorithm>;
  requestParameterSupported: boolean;
  requestUriParameterSupported: boolean;
  /**
   * OPTIONAL
   *
   * RFC 9126 §5 — Pushed Authorization Requests. Whether the
   * authorization server accepts authorization requests only via PAR.
   *
   * https://www.rfc-editor.org/rfc/rfc9126
   */
  requirePushedAuthorizationRequests?: boolean;
  /**
   * OPTIONAL
   *
   * RFC 9101 §10.5 — JWT-Secured Authorization Request (JAR).
   * Whether the authorization server accepts request objects only
   * as signed JWTs.
   *
   * https://www.rfc-editor.org/rfc/rfc9101
   */
  requireSignedRequestObject?: boolean;
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
