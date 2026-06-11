// https://www.rfc-editor.org/rfc/rfc7662#section-2.2

import type { AuthorizationDetail } from "./open-id-authorization-detail.js";

export type OpenIdIntrospectResponse = {
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
   * RFC 9396 §9 — Rich Authorization Requests. The authorization
   * details associated with this token, as a JSON array of
   * objects, mirroring the `authorization_details` granted at
   * issuance. Returned by the AS so that the protected resource
   * can enforce the fine-grained authorization carried by the
   * token. Type-specific fields are carried verbatim.
   *
   * https://www.rfc-editor.org/rfc/rfc9396
   */
  authorizationDetails?: Array<AuthorizationDetail>;

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
  tokenType: string | null;

  /**
   * OPTIONAL
   *
   * Human-readable identifier for the resource owner who
   * authorized this token.
   */
  username: string | null;
};
