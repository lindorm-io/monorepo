// https://www.rfc-editor.org/rfc/rfc7662#section-2.1

export type OpenIdIntrospectRequestBody = {
  /**
   * REQUIRED
   * The string value of the token. For access tokens, this
   * is the "access_token" value returned from the token
   * endpoint defined in OAuth 2.0 [RFC6749], Section 5.1.
   * For refresh tokens, this is the "refresh_token" value
   * returned from the token endpoint as defined in OAuth 2.0
   * [RFC6749], Section 5.1. Other token types are outside
   * the scope of this specification.
   */
  token: string;

  /**
   * OPTIONAL
   *
   * A hint about the type of the token submitted for
   * introspection.  The protected resource MAY pass this
   * parameter to help the authorization server optimize
   * the token lookup.  If the server is unable to locate
   * the token using the given hint, it MUST extend its search
   * across all of its supported token types. An authorization
   * server MAY ignore this parameter, particularly if it is
   * able to detect the token type automatically. Values for
   * this field are defined in the "OAuth Token Type Hints"
   * registry defined in OAuth Token Revocation [RFC7009].
   */
  tokenTypeHint?: string;
};

// https://www.rfc-editor.org/rfc/rfc7662#section-2.2

export type OpenIdIntrospectResponseBody = {
  /**
   * REQUIRED
   *
   * Boolean indicator of whether or not the presented token
   * is currently active. The specifics of a token's "active"
   * state will vary depending on the implementation of the
   * authorization server and the information it keeps about
   * its tokens, but a "true" value return for the "active"
   * property will generally indicate that a given token has
   * been issued by this authorization server, has not been
   * revoked by the resource owner, and is within its given
   * time window of validity (e.g., after its issuance time
   * and before its expiration time). See Section 4 for
   * information on implementation of such checks.
   */
  active: boolean;

  /**
   * OPTIONAL
   *
   * Service-specific string identifier or list of string
   * identifiers representing the intended audience for this
   * token, as defined in JWT [RFC7519].
   */
  aud: Array<string>;

  /**
   * OPTIONAL
   *
   * Client identifier for the OAuth 2.0 client that
   * requested this token.
   */
  clientId: string | null;

  /**
   * OPTIONAL
   *
   * Integer timestamp, measured in the number of seconds
   * since January 1 1970 UTC, indicating when this token
   * will expire, as defined in JWT [RFC7519].
   */
  exp: number;

  /**
   * OPTIONAL
   *
   * Integer timestamp, measured in the number of seconds
   * since January 1 1970 UTC, indicating when this token
   * was originally issued, as defined in JWT [RFC7519].
   */
  iat: number;

  /**
   * OPTIONAL
   *
   * String representing the issuer of this token, as
   * defined in JWT [RFC7519].
   */
  iss: string | null;

  /**
   * OPTIONAL
   *
   * String identifier for the token, as defined in
   * JWT [RFC7519].
   */
  jti: string | null;

  /**
   * OPTIONAL
   *
   * Integer timestamp, measured in the number of seconds
   * since January 1 1970 UTC, indicating when this token
   * is not to be used before, as defined in JWT [RFC7519].
   */
  nbf: number;

  /**
   * OPTIONAL
   *
   * A JSON string containing a space-separated list of
   * scopes associated with this token, in the format
   * described in Section 3.3 of OAuth 2.0 [RFC6749].
   */
  scope: string | null;

  /**
   * OPTIONAL
   *
   * Subject of the token, as defined in JWT [RFC7519].
   * Usually a machine-readable identifier of the resource
   * owner who authorized this token.
   */
  sub: string | null;

  /**
   * OPTIONAL
   *
   * Type of the token as defined in Section 5.1 of
   * OAuth 2.0 [RFC6749].
   */
  tokenType: "access_token" | "refresh_token" | null;

  /**
   * OPTIONAL
   *
   * Human-readable identifier for the resource owner who
   * authorized this token.
   */
  username: string | null;
};
