// https://openid.net/specs/openid-connect-core-1_0.html#TokenEndpoint
// https://www.rfc-editor.org/rfc/rfc8693
// https://www.rfc-editor.org/rfc/rfc6749

export type OpenIdTokenResponse = {
  /**
   * The access token issued by the authorization server.
   */
  accessToken?: string;

  /**
   * The lifetime in seconds of the access token. For example,
   * the value "3600" denotes that the access token will expire
   * in one hour from the time the response was generated.
   * If omitted, the authorization server SHOULD provide the
   * expiration time via other means or document the
   * default value.
   */
  expiresIn?: number;

  /**
   * The unix date in seconds for when the access token expires.
   * The value is based on the current time in UTC and the expiresIn
   * value.
   */
  expiresOn?: number;

  /**
   * ID Token value associated with the authenticated session.
   */
  idToken?: string;

  /**
   * The refresh token, which can be used to obtain new access
   * tokens using the same authorization grant as described
   * in Section 6.
   */
  refreshToken?: string;

  /**
   * If identical to the scope requested by the client;
   * otherwise, REQUIRED.  The scope of the access token
   * as described by Section 3.3.
   */
  scope?: string;

  /**
   * The type of the token issued as described in
   * Section 7.1. Value is case insensitive.
   */
  tokenType?: "Bearer" | string;
};
