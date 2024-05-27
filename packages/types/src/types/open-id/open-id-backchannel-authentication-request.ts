export type OpenIdBackchannelAuthenticationRequest = {
  /**
   * OPTIONAL
   *
   * Requested Authentication Context Class Reference values.
   * A space-separated string that specifies the acr values that
   * the OpenID Provider is being requested to use for processing
   * this Authentication Request, with the values appearing in
   * order of preference. The actual means of authenticating
   * the end-user, however, are ultimately at the discretion of
   * the OP, and the Authentication Context Class satisfied by
   * the authentication performed is returned as the acr Claim
   * Value of the ID Token. When the acr_values parameter is
   * present in the authentication request, it is highly
   * RECOMMENDED that the resulting ID Token contains an acr Claim.
   */
  acrValues?: string;

  /**
   * OPTIONAL
   *
   * A human-readable identifier or message intended to be
   * displayed on both the consumption device and the
   * authentication device to interlock them together for
   * the transaction by way of a visual cue for the end-user.
   * This interlocking message enables the end-user to ensure
   * that the action taken on the authentication device is
   * related to the request initiated by the consumption
   * device. The value SHOULD contain something that enables
   * the end-user to reliably discern that the transaction
   * is related across the consumption device and the
   * authentication device, such as a random value of reasonable
   * entropy (e.g. a transactional approval code). Because
   * the various devices involved may have limited display
   * abilities and the message is intending for visual
   * inspection by the end-user, the binding_message value
   * SHOULD be relatively short and use a limited set of
   * plain text characters. The invalid_binding_message
   * defined in Section 13 is used in the case that it is
   * necessary to inform the Client that the provided
   * binding_message is unacceptable.
   */
  bindingMessage?: string;

  /**
   * OPTIONAL
   *
   * When applicable, additional parameters required by the
   * given client authentication method are also included
   * (e.g. JWT assertion-based client authentication uses
   * client_assertion and client_assertion_type while Mutual
   * TLS client authentication uses client_id).
   */
  clientId?: string;
  clientAssertion?: string;
  clientAssertionType?: string;

  /**
   * REQUIRED if the Client is registered to use Ping or Push modes
   *
   * It is a bearer token provided by the Client that will
   * be used by the OpenID Provider to authenticate the
   * callback request to the Client. The length of the token
   * MUST NOT exceed 1024 characters and it MUST conform to
   * the syntax for Bearer credentials as defined in
   * Section 2.1 of [RFC6750]. Clients MUST ensure that it
   * contains sufficient entropy (a minimum of 128 bits
   * while 160 bits is recommended) to make brute force
   * guessing or forgery of a valid token computationally
   * infeasible - the means of achieving this are
   * implementation-specific, with possible approaches
   * including secure pseudorandom number generation or
   * cryptographically secured self-contained tokens.
   */
  clientNotificationToken?: string;

  /**
   * OPTIONAL
   *
   * An ID Token previously issued to the Client by the
   * OpenID Provider being passed back as a hint to identify
   * the end-user for whom authentication is being requested.
   * If the ID Token received by the Client from the OP was
   * asymmetrically encrypted, to use it as an id_token_hint,
   * the client MUST decrypt the encrypted ID Token to
   * extract the signed ID Token contained in it.
   */
  idTokenHint?: string;

  /**
   * OPTIONAL
   *
   * A hint to the OpenID Provider regarding the end-user
   * for whom authentication is being requested. The value
   * may contain an email address, phone number, account
   * number, subject identifier, username, etc., which
   * identifies the end-user to the OP. The value may be directly
   * collected from the user by the Client before requesting
   * authentication at the OP, for example, but may also be
   * obtained by other means.
   */
  loginHint?: string;

  /**
   * OPTIONAL
   *
   * A token containing information identifying the end-user
   * for whom authentication is being requested. The particular
   * details and security requirements for the login_hint_token
   * as well as how the end-user is identified by its content
   * are deployment or profile specific.
   */
  loginHintToken?: string;

  /**
   * REQUIRED
   *
   * The scope of the access request as described by
   * Section 3.3 of [RFC6749]. OpenID Connect implements
   * authentication as an extension to OAuth 2.0 by including
   * the openid scope value in the authorization requests.
   * Consistent with that, CIBA authentication requests MUST
   * therefore contain the openid scope value. The behavior
   * when the openid scope value is not present is left
   * unspecified by this document, thus allowing for the
   * potential definition of the behavior in a non-OpenID context,
   * such as an OAuth authorization flow. Other scope values
   * MAY be present, including but not limited to the profile,
   * email, address, and phone scope values from
   * Section 5.4 of [OpenID.Core].
   */
  scope: string;

  /**
   * OPTIONAL
   *
   * A secret code, such as a password or pin, that is known
   * only to the user but verifiable by the OP. The code is
   * used to authorize sending an authentication request to
   * the user's authentication device. This parameter should
   * only be present if the client registration parameter
   * backchannel_user_code_parameter indicates support for
   * the user code.
   */
  userCode?: string;

  /**
   * OPTIONAL
   *
   * A positive integer allowing the client to request the
   * expires_in value for the auth_req_id the server will
   * return. The server MAY use this value to influence the
   * lifetime of the authentication request and is encouraged
   * to do so where it will improve the user experience,
   * for example by terminating the authentication when as
   * it knows the client is no longer interested in the result.
   */
  requestedExpiry?: number;
};
