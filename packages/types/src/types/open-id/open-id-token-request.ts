// https://openid.net/specs/openid-connect-core-1_0.html#TokenEndpoint
// https://www.rfc-editor.org/rfc/rfc8693
// https://www.rfc-editor.org/rfc/rfc6749

import { OpenIdGrantType } from "./open-id-grant-type";

export type OpenIdTokenRequest = {
  /**
   * OPTIONAL
   *
   * A security token that represents the identity of the
   * acting party. Typically, this will be the party that
   * is authorized to use the requested security token and
   * act on behalf of the subject.
   */
  actorToken?: string;

  /**
   * OPTIONAL / REQUIRED
   *
   * An identifier, as described in Section 3, that indicates
   * the type of the security token in the actor_token parameter.
   * This is REQUIRED when the actor_token parameter is present
   * in the request but MUST NOT be included otherwise.
   */
  actorTokenType?: string;

  /**
   * OPTIONAL
   *
   * https://www.rfc-editor.org/rfc/rfc7523#section-2.1
   *
   * To use a Bearer JWT as an authorization grant, the client uses
   * an access token request as defined in Section 4 of the OAuth
   * Assertion Framework [RFC7521] with the following specific
   * parameter values and encodings.
   *
   * The value of the "assertion" parameter MUST contain a single
   * JWT.
   */
  assertion?: string;

  /**
   * OPTIONAL
   *
   * The logical name of the target service where the client
   * intends to use the requested security token. This serves
   * a purpose similar to the resource parameter but with the
   * client providing a logical name for the target service.
   * Interpretation of the name requires that the value be
   * something that both the client and the authorization
   * server understand. An OAuth client identifier, a SAML
   * entity identifier [OASIS.saml-core-2.0-os], and an OpenID
   * Connect Issuer Identifier [OpenID.Core] are examples of
   * things that might be used as audience parameter values.
   * However, audience values used with a given authorization
   * server must be unique within that server to ensure that
   * they are properly interpreted as the intended type of
   * value. Multiple audience parameters may be used to indicate
   * that the issued token is intended to be used at the multiple
   * audiences listed. The audience and resource parameters
   * may be used together to indicate multiple target services
   * with a mix of logical names and resource URIs.
   */
  audience?: string;

  /**
   * REQUIRED if the grant type is backchannel authentication
   *
   * It is the unique identifier to identify the authentication
   * request (transaction) made by the Client. The OP MUST check
   * whether the auth_req_id was issued to this Client in response
   * to an Authentication Request. Otherwise, an error MUST be
   * returned.
   */
  authReqId?: string;

  /**
   * OPTIONAL
   *
   * To use a JWT Bearer Token for client authentication,
   * the client uses the following parameter values and encodings.
   *
   * The value of the "client_assertion" parameter contains a
   * single JWT. It MUST NOT contain more than one JWT.
   *
   * https://www.rfc-editor.org/rfc/rfc7523#section-2.2
   */
  clientAssertion?: string;

  /**
   * OPTIONAL
   *
   * To use a JWT Bearer Token for client authentication,
   * the client uses the following parameter values and encodings.
   *
   * The value of the "client_assertion_type" is
   * "urn:ietf:params:oauth:client-assertion-type:jwt-bearer".
   *
   * https://www.rfc-editor.org/rfc/rfc7523#section-2.2
   */
  clientAssertionType?: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

  /**
   * OPTIONAL
   *
   * REQUIRED, if the client is not authenticating with the
   * authorization server as described in Section 3.2.1.
   */
  clientId?: string;

  /**
   * OPTIONAL
   *
   * The client secret. The client MAY omit the parameter if
   * the client secret is an empty string.
   */
  clientSecret?: string;

  /**
   * OPTIONAL
   *
   * The authorization code received from the authorization server.
   */
  code?: string;

  /**
   * OPTIONAL
   *
   * The code verifier used for authorization code.
   */
  codeVerifier?: string;

  /**
   * REQUIRED
   *
   * The value indicates what strategy is requested to be performed.
   */
  grantType: OpenIdGrantType;

  /**
   * OPTIONAL
   *
   * The resource owner password.
   */
  password?: string;

  /**
   * OPTIONAL
   *
   * REQUIRED, if the "redirect_uri" parameter was included
   * in the authorization request as described in Section
   * 4.1.1, and their values MUST be identical.
   */
  redirectUri?: string;

  /**
   * OPTIONAL
   *
   * The refresh token issued to the client.
   */
  refreshToken?: string;

  /**
   * OPTIONAL
   *
   * An identifier, as described in Section 3, for the type of
   * the requested security token. If the requested type is
   * unspecified, the issued token type is at the discretion
   * of the authorization server and may be dictated by knowledge
   * of the requirements of the service or resource indicated
   * by the resource or audience parameter.
   */
  requestedTokenType?: string;

  /**
   * OPTIONAL
   *
   * A URI that indicates the target service or resource
   * where the client intends to use the requested security token.
   * This enables the authorization server to apply policy as
   * appropriate for the target, such as determining the type
   * and content of the token to be issued or if and how
   * the token is to be encrypted. In many cases, a client
   * will not have knowledge of the logical organization
   * of the systems with which it interacts and will only
   * know a URI of the service where it intends to use
   * the token. The resource parameter allows the client
   * to indicate to the authorization server where it
   * intends to use the issued token by providing the location,
   * typically as an https URL, in the token exchange request
   * in the same form that will be used to access that resource.
   * The authorization server will typically have the capability
   * to map from a resource URI value to an appropriate policy.
   * The value of the resource parameter MUST be an absolute
   * URI, as specified by Section 4.3 of [RFC3986], that MAY
   * include a query component and MUST NOT include a fragment
   * component. Multiple resource parameters may be used to
   * indicate that the issued token is intended to be used at
   * the multiple resources listed. See [OAUTH-RESOURCE] for
   * additional background and uses of the resource parameter.
   */
  resource?: string;

  /**
   * OPTIONAL
   *
   * A list of space-delimited, case-sensitive strings,
   * as defined in Section 3.3 of [RFC6749], that allow
   * the client to specify the desired scope of the requested
   * security token in the context of the service or resource
   * where the token will be used. The values and associated
   * semantics of scope are service specific and expected
   * to be described in the relevant service documentation.
   */
  scope?: string;

  /**
   * OPTIONAL
   *
   * A security token that represents the identity of
   * the party on behalf of whom the request is being made.
   * Typically, the subject of this token will be the subject
   * of the security token issued in response to the request.
   */
  subjectToken?: string;

  /**
   * OPTIONAL
   *
   * An identifier, as described in Section 3, that indicates
   * the type of the security token in the subject_token
   * parameter.
   */
  subjectTokenType?: string;

  /**
   * OPTIONAL
   *
   * The resource owner username.
   */
  username?: string;
};
