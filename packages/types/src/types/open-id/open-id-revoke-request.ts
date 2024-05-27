export type OpenIdRevokeRequest = {
  /**
   * REQUIRED
   *
   * The token that the client wants to get revoked.
   */
  token: string;

  /**
   * OPTIONAL
   *
   * A hint about the type of the token submitted for
   * revocation. Clients MAY pass this parameter in
   * order to help the authorization server to optimize
   * the token lookup. If the server is unable to locate
   * the token using the given hint, it MUST extend its
   * search across all of its supported token types.
   * An authorization server MAY ignore this parameter,
   * particularly if it is able to detect the token
   * type automatically.
   *
   * This specification defines two such values:
   *
   * - access_token
   *   An access token as defined in [RFC6749], Section 1.4
   *
   * - refresh_token
   *   A refresh token as defined in [RFC6749], Section 1.5
   *
   * Specific implementations, profiles, and extensions of
   * this specification MAY define other values for this
   * parameter using the registry defined in Section 4.1.2.
   */
  tokenTypeHint?: "access_token" | "refresh_token" | string;
};
