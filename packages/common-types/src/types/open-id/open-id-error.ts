// https://openid.net/specs/openid-connect-core-1_0.html#AuthError

export type OpenIdErrorCode =
  | "interaction_required"
  | "login_required"
  | "consent_required"
  | "invalid_request_uri"
  | "account_selection_required"
  | "invalid_request_object"
  | "request_not_supported"
  | "request_uri_not_supported"
  | "registration_not_supported";

export type OpenIdErrorResponse = {
  /**
   * REQUIRED
   *
   * Error code.
   */
  error: OpenIdErrorCode | string;

  /**
   * OPTIONAL
   *
   * Human-readable ASCII encoded text description
   * of the error.
   */
  error_description?: string;

  /**
   * OPTIONAL
   *
   * URI of a web page that includes additional
   * information about the error.
   */
  error_uri?: string;

  /**
   * OAuth 2.0 state value. REQUIRED if the Authorization
   * Request included the state parameter. Set to the value
   * received from the Client.
   */
  state?: string;
};
