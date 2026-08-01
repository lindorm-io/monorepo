// https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
// https://www.rfc-editor.org/rfc/rfc8414#section-2

import type {
  AesEncryption,
  JwksEncryptionAlgorithm,
  JwksSigningAlgorithm,
} from "@lindorm/types";
import type { BackchannelTokenDeliveryMode } from "../enums/BackchannelTokenDeliveryMode.js";
import type { ClaimType } from "../enums/ClaimType.js";
import type { CodeChallengeMethod } from "../enums/CodeChallengeMethod.js";
import type { DisplayMode } from "../enums/DisplayMode.js";
import type { GrantType } from "../enums/GrantType.js";
import type { ResponseMode } from "../enums/ResponseMode.js";
import type { ResponseType } from "../enums/ResponseType.js";
import type { Scope } from "../enums/Scope.js";
import type { SubjectType } from "../enums/SubjectType.js";
import type { TokenEndpointAuthMethod } from "../enums/TokenEndpointAuthMethod.js";

/**
 * LINDORM / VENDOR EXTENSIONS. Metadata members that no RFC defines. They are
 * kept separate from the standard shape so a reader can always tell which half
 * of the document is spec and which half is ours.
 */
type LindormOpenIdConfiguration = {
  /**
   * wire: `gdpr_right_to_erasure_endpoint` — LINDORM EXTENSION (registry E9),
   * OPTIONAL. Subject-initiated GDPR erasure (Art. 17). Present only when GDPR
   * DSR is enabled.
   */
  gdprRightToErasureEndpoint?: string;

  /**
   * wire: `gdpr_right_of_access_endpoint` — LINDORM EXTENSION (registry E9),
   * OPTIONAL. Subject-initiated GDPR data disclosure / right of access
   * (Art. 15). Present only when GDPR DSR is enabled.
   */
  gdprRightOfAccessEndpoint?: string;

  /**
   * wire: `gdpr_right_to_data_portability_endpoint` — LINDORM EXTENSION
   * (registry E9), OPTIONAL. Subject-initiated GDPR data portability
   * (Art. 20). Present only when GDPR DSR is enabled.
   */
  gdprRightToDataPortabilityEndpoint?: string;
};

/**
 * The RFC-defined provider metadata. Requirement levels are OIDC Discovery 1.0
 * §3 (which is stricter than RFC 8414 §2 and therefore governs here); every
 * member carries its wire name, requirement level, and defining spec.
 */
type StandardOpenIdConfiguration = {
  // ---------------------------------------------------------------- REQUIRED

  /**
   * wire: `issuer` — REQUIRED (OIDC Discovery §3, RFC 8414 §2). The provider's
   * issuer identifier; MUST be an https URL with no query or fragment, and
   * MUST exactly match the `iss` claim of issued tokens.
   */
  issuer: string;

  /**
   * wire: `authorization_endpoint` — REQUIRED (OIDC Discovery §3, RFC 8414 §2
   * marks it required unless no supported grant type uses it).
   */
  authorizationEndpoint: string;

  /**
   * wire: `token_endpoint` — REQUIRED (OIDC Discovery §3), except for a
   * provider supporting ONLY the implicit flow. Required here: every lindorm
   * consumer exchanges a code or a client credential.
   */
  tokenEndpoint: string;

  /**
   * wire: `jwks_uri` — REQUIRED (OIDC Discovery §3; RECOMMENDED by RFC 8414
   * §2). URL of the provider's JWK Set — see `JwksResponse`.
   */
  jwksUri: string;

  /**
   * wire: `response_types_supported` — REQUIRED (OIDC Discovery §3,
   * RFC 8414 §2).
   */
  responseTypesSupported: Array<ResponseType>;

  /**
   * wire: `subject_types_supported` — REQUIRED (OIDC Discovery §3). Values are
   * `pairwise` / `public` (OIDC Core §8).
   */
  subjectTypesSupported: Array<SubjectType>;

  /**
   * wire: `id_token_signing_alg_values_supported` — REQUIRED (OIDC Discovery
   * §3). MUST include `RS256`.
   */
  idTokenSigningAlgValuesSupported: Array<JwksSigningAlgorithm>;

  // ------------------------------------------------- RECOMMENDED ⇒ OPTIONAL

  /** wire: `userinfo_endpoint` — RECOMMENDED (OIDC Discovery §3) */
  userinfoEndpoint?: string;

  /** wire: `registration_endpoint` — RECOMMENDED (OIDC Discovery §3, RFC 7591) */
  registrationEndpoint?: string;

  /**
   * wire: `scopes_supported` — RECOMMENDED (OIDC Discovery §3, RFC 8414 §2).
   * The provider MAY omit scopes it does not advertise publicly.
   */
  scopesSupported?: Array<Scope>;

  /**
   * wire: `claims_supported` — RECOMMENDED (OIDC Discovery §3). WIRE claim
   * names (snake_case), not the camelCase keys of `Claims`.
   */
  claimsSupported?: Array<string>;

  // ---------------------------------------------------------------- ENDPOINTS

  /**
   * wire: `introspection_endpoint` — OPTIONAL (RFC 8414 §2, RFC 7662 §2).
   * NOTE the RFC name: it is `introspection_endpoint`, never
   * `introspect_endpoint`.
   */
  introspectionEndpoint?: string;

  /**
   * wire: `revocation_endpoint` — OPTIONAL (RFC 8414 §2, RFC 7009 §2). The one
   * and only revocation member; there is no `revoke_endpoint`.
   */
  revocationEndpoint?: string;

  /**
   * wire: `end_session_endpoint` — OPTIONAL (OIDC RP-Initiated Logout 1.0 §2).
   * The RP-initiated logout endpoint; there is no `logout_endpoint`.
   */
  endSessionEndpoint?: string;

  /** wire: `device_authorization_endpoint` — OPTIONAL (RFC 8628 §4) */
  deviceAuthorizationEndpoint?: string;

  /** wire: `pushed_authorization_request_endpoint` — OPTIONAL (RFC 9126 §5) */
  pushedAuthorizationRequestEndpoint?: string;

  /** wire: `backchannel_authentication_endpoint` — OPTIONAL (OpenID CIBA Core 1.0 §4) */
  backchannelAuthenticationEndpoint?: string;

  /**
   * wire: `authorization_challenge_endpoint` — OPTIONAL
   * (draft-ietf-oauth-first-party-apps). The browserless Authorization
   * Challenge Endpoint for first-party native login.
   */
  authorizationChallengeEndpoint?: string;

  // ----------------------------------------------------- CLIENT AUTHENTICATION

  /**
   * wire: `token_endpoint_auth_methods_supported` — OPTIONAL (OIDC Discovery
   * §3, RFC 8414 §2). When absent the spec default is
   * `["client_secret_basic"]`.
   */
  tokenEndpointAuthMethodsSupported?: Array<TokenEndpointAuthMethod>;

  /** wire: `token_endpoint_auth_signing_alg_values_supported` — OPTIONAL (OIDC Discovery §3) */
  tokenEndpointAuthSigningAlgValuesSupported?: Array<JwksSigningAlgorithm>;

  /** wire: `introspection_endpoint_auth_methods_supported` — OPTIONAL (RFC 8414 §2) */
  introspectionEndpointAuthMethodsSupported?: Array<TokenEndpointAuthMethod>;

  /** wire: `revocation_endpoint_auth_methods_supported` — OPTIONAL (RFC 8414 §2) */
  revocationEndpointAuthMethodsSupported?: Array<TokenEndpointAuthMethod>;

  // ---------------------------------------------------------- CAPABILITY SETS

  /** wire: `acr_values_supported` — OPTIONAL (OIDC Discovery §3) */
  acrValuesSupported?: Array<string>;

  /** wire: `claim_types_supported` — OPTIONAL (OIDC Discovery §3); default `["normal"]` */
  claimTypesSupported?: Array<ClaimType>;

  /** wire: `code_challenge_methods_supported` — OPTIONAL (RFC 8414 §2, RFC 7636) */
  codeChallengeMethodsSupported?: Array<CodeChallengeMethod>;

  /** wire: `display_values_supported` — OPTIONAL (OIDC Discovery §3) */
  displayValuesSupported?: Array<DisplayMode>;

  /**
   * wire: `grant_types_supported` — OPTIONAL (OIDC Discovery §3, RFC 8414 §2);
   * default `["authorization_code", "implicit"]`.
   */
  grantTypesSupported?: Array<GrantType>;

  /**
   * wire: `response_modes_supported` — OPTIONAL (OIDC Discovery §3, RFC 8414
   * §2); default `["query", "fragment"]`.
   */
  responseModesSupported?: Array<ResponseMode>;

  /** wire: `ui_locales_supported` — OPTIONAL (OIDC Discovery §3) */
  uiLocalesSupported?: Array<string>;

  // ------------------------------------------------------------ ID TOKEN / JWE

  /** wire: `id_token_encryption_alg_values_supported` — OPTIONAL (OIDC Discovery §3) */
  idTokenEncryptionAlgValuesSupported?: Array<JwksEncryptionAlgorithm>;

  /** wire: `id_token_encryption_enc_values_supported` — OPTIONAL (OIDC Discovery §3) */
  idTokenEncryptionEncValuesSupported?: Array<AesEncryption>;

  /** wire: `userinfo_signing_alg_values_supported` — OPTIONAL (OIDC Discovery §3) */
  userinfoSigningAlgValuesSupported?: Array<JwksSigningAlgorithm>;

  /** wire: `userinfo_encryption_alg_values_supported` — OPTIONAL (OIDC Discovery §3) */
  userinfoEncryptionAlgValuesSupported?: Array<JwksEncryptionAlgorithm>;

  /** wire: `userinfo_encryption_enc_values_supported` — OPTIONAL (OIDC Discovery §3) */
  userinfoEncryptionEncValuesSupported?: Array<AesEncryption>;

  // -------------------------------------------------- REQUEST OBJECTS (RFC 9101)

  /** wire: `request_object_signing_alg_values_supported` — OPTIONAL (RFC 9101, OIDC Discovery §3) */
  requestObjectSigningAlgValuesSupported?: Array<JwksSigningAlgorithm>;

  /** wire: `request_object_encryption_alg_values_supported` — OPTIONAL (RFC 9101, OIDC Discovery §3) */
  requestObjectEncryptionAlgValuesSupported?: Array<JwksEncryptionAlgorithm>;

  /** wire: `request_object_encryption_enc_values_supported` — OPTIONAL (RFC 9101, OIDC Discovery §3) */
  requestObjectEncryptionEncValuesSupported?: Array<AesEncryption>;

  /** wire: `request_parameter_supported` — OPTIONAL (OIDC Discovery §3); default `false` */
  requestParameterSupported?: boolean;

  /** wire: `request_uri_parameter_supported` — OPTIONAL (OIDC Discovery §3); default `true` */
  requestUriParameterSupported?: boolean;

  /** wire: `require_request_uri_registration` — OPTIONAL (OIDC Discovery §3); default `false` */
  requireRequestUriRegistration?: boolean;

  /** wire: `require_signed_request_object` — OPTIONAL (RFC 9101 §10.5); default `false` */
  requireSignedRequestObject?: boolean;

  /** wire: `require_pushed_authorization_requests` — OPTIONAL (RFC 9126 §5); default `false` */
  requirePushedAuthorizationRequests?: boolean;

  /** wire: `claims_parameter_supported` — OPTIONAL (OIDC Discovery §3); default `false` */
  claimsParameterSupported?: boolean;

  // ---------------------------------------------------------- JARM (JWT-secured)

  /**
   * wire: `authorization_signing_alg_values_supported` — OPTIONAL (JARM §4).
   * JWS `alg` values for signing authorization response JWTs.
   */
  authorizationSigningAlgValuesSupported?: Array<JwksSigningAlgorithm>;

  /** wire: `authorization_encryption_alg_values_supported` — OPTIONAL (JARM §4) */
  authorizationEncryptionAlgValuesSupported?: Array<JwksEncryptionAlgorithm>;

  /** wire: `authorization_encryption_enc_values_supported` — OPTIONAL (JARM §4) */
  authorizationEncryptionEncValuesSupported?: Array<AesEncryption>;

  // --------------------------------------------------- JWT INTROSPECTION (9701)

  /** wire: `introspection_signing_alg_values_supported` — OPTIONAL (RFC 9701 §7) */
  introspectionSigningAlgValuesSupported?: Array<JwksSigningAlgorithm>;

  /** wire: `introspection_encryption_alg_values_supported` — OPTIONAL (RFC 9701 §7) */
  introspectionEncryptionAlgValuesSupported?: Array<JwksEncryptionAlgorithm>;

  /** wire: `introspection_encryption_enc_values_supported` — OPTIONAL (RFC 9701 §7) */
  introspectionEncryptionEncValuesSupported?: Array<AesEncryption>;

  // ------------------------------------------------------------------- CIBA

  /** wire: `backchannel_token_delivery_modes_supported` — OPTIONAL (CIBA Core 1.0 §4) */
  backchannelTokenDeliveryModesSupported?: Array<BackchannelTokenDeliveryMode>;

  /** wire: `backchannel_authentication_request_signing_alg_values_supported` — OPTIONAL (CIBA Core 1.0 §4) */
  backchannelAuthenticationRequestSigningAlgValuesSupported?: Array<JwksSigningAlgorithm>;

  /** wire: `backchannel_user_code_parameter_supported` — OPTIONAL (CIBA Core 1.0 §4); default `false` */
  backchannelUserCodeParameterSupported?: boolean;

  // --------------------------------------------------------- LOGOUT / SESSION

  /** wire: `backchannel_logout_supported` — OPTIONAL (OIDC Back-Channel Logout 1.0 §3); default `false` */
  backchannelLogoutSupported?: boolean;

  /** wire: `backchannel_logout_session_supported` — OPTIONAL (OIDC Back-Channel Logout 1.0 §3); default `false` */
  backchannelLogoutSessionSupported?: boolean;

  // -------------------------------------------------------------------- MISC

  /** wire: `authorization_details_types_supported` — OPTIONAL (RFC 9396 §10) */
  authorizationDetailsTypesSupported?: Array<string>;

  /** wire: `authorization_response_iss_parameter_supported` — OPTIONAL (RFC 9207 §3); default `false` */
  authorizationResponseIssParameterSupported?: boolean;

  /** wire: `dpop_signing_alg_values_supported` — OPTIONAL (RFC 9449 §5.1) */
  dpopSigningAlgValuesSupported?: Array<JwksSigningAlgorithm>;

  /** wire: `op_policy_uri` — OPTIONAL (OIDC Discovery §3, RFC 8414 §2) */
  opPolicyUri?: string;

  /** wire: `op_tos_uri` — OPTIONAL (OIDC Discovery §3, RFC 8414 §2) */
  opTosUri?: string;

  /** wire: `service_documentation` — OPTIONAL (OIDC Discovery §3, RFC 8414 §2) */
  serviceDocumentation?: string;
};

/**
 * The OpenID Provider / OAuth 2.0 authorization server metadata document —
 * OIDC Discovery 1.0 §3 and RFC 8414 §2, camelised.
 *
 * ONE type serves both directions: a relying party reading a remote document,
 * and a provider serving its own. That works because the requirement levels
 * are the specs' own — a member the specs mark REQUIRED is required here, so a
 * reader may rely on it, and everything else is optional, so a reader must
 * handle its absence at the point of use.
 *
 * The shape is deliberately CLOSED (no index signature). Excess-property
 * checking is what catches a mistyped member when a provider constructs its
 * own document — the very class of bug the previous type shipped
 * (`introspectEndpoint`, `logoutEndpoint`, `revokeEndpoint`). Non-standard
 * members a remote provider emits still survive at runtime; reading one is a
 * deliberate, greppable cast rather than silently-typed `unknown` everywhere.
 *
 * NAME — a DELIBERATE exception to this package's "the package is the
 * namespace" rule (which is why `OpenIdScope` is `Scope`, `OpenIdGrantType` is
 * `GrantType`, …). DO NOT "clean up" the prefix. Here `OpenId` is the
 * document's PROPER NOUN, not a namespace: the well-known URI is literally
 * `/.well-known/openid-configuration` and the whole ecosystem calls it "the
 * openid-configuration". The bare noun `Configuration` was genuinely ambiguous
 * at use sites — `get-open-id-configuration.ts` had `config: PylonAuthConfig`
 * and `Configuration` in the same four-line signature — while every
 * surrounding identifier already spells the full name (amphora's
 * `openIdConfiguration` / `openIdConfigurationUri`, pylon's
 * `getOpenIdConfiguration` and its `openid_configuration_not_found` /
 * `openid_configuration_incomplete` error codes, tyr's own local type).
 * Spec-derived names (`ProviderMetadata`, `AuthorizationServerMetadata`) were
 * rejected because this ONE type serves BOTH `/.well-known/openid-configuration`
 * (OIDC Discovery §3, "OpenID Provider Metadata") and
 * `/.well-known/oauth-authorization-server` (RFC 8414 §2, "Authorization Server
 * Metadata") — either spec's term mislabels half the job.
 */
export type OpenIdConfiguration = LindormOpenIdConfiguration &
  StandardOpenIdConfiguration;
