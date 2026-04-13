// https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
// https://www.rfc-editor.org/rfc/rfc7636#section-4.1
// https://openid.net/specs/openid-connect-core-1_0.html#ImplicitAuthResponse
// https://www.rfc-editor.org/rfc/rfc6749#section-4.1.2.1

type LindormResponse = {
  /**
   * Expiration date of the Access Token in UNIX timestamp format.
   */
  expiresOn?: number;
};

export type OpenIdAuthorizeResponseQuery = LindormResponse & {
  /**
   * OAuth 2.0 Access Token. This is returned when the response_type value used is code token, or code id_token token. (A token_type value is also returned in the same cases.)
   */
  accessToken?: string;

  /**
   * Authorization Code. This is always returned when using the Hybrid Flow.
   */
  code?: string;

  /**
   * RFC 6749 §4.1.2.1 — error code returned when the authorization request fails.
   * REQUIRED if the request fails. Common values: invalid_request, unauthorized_client,
   * access_denied, unsupported_response_type, invalid_scope, server_error,
   * temporarily_unavailable.
   */
  error?: string;

  /**
   * RFC 6749 §4.1.2.1 — human-readable error description for developers.
   * OPTIONAL.
   */
  errorDescription?: string;

  /**
   * RFC 6749 §4.1.2.1 — URI to a human-readable web page with error info.
   * OPTIONAL.
   */
  errorUri?: string;

  /**
   * Expiration time of the Access Token in seconds since the response was generated.
   */
  expiresIn?: number;

  /**
   * ID Token. This is returned when the response_type value used is code id_token or code id_token token.
   */
  idToken?: string;

  /**
   * OAuth 2.0 state value. REQUIRED if the state parameter is present in the Authorization Request. Clients MUST verify that the state value is equal to the value of state parameter in the Authorization Request.
   */
  state?: string;

  /**
   * OAuth 2.0 Token Type value. The value MUST be Bearer or another token_type value that the Client has negotiated with the Authorization Server. Clients implementing this profile MUST support the OAuth 2.0 Bearer Token Usage [RFC6750] specification. This profile only describes the use of bearer tokens. This is returned in the same cases as access_token is.
   */
  tokenType?: "Bearer";
};
