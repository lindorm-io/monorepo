type LindormResponse = {
  /**
   * OPTIONAL
   *
   * A JSON number with a positive integer value indicating the
   * expiration time of the "auth_req_id" as a UNIX timestamp.
   */
  expiresOn?: number;
};

export type OpenIdBackchannelAuthenticationResponse = LindormResponse & {
  /**
   * REQUIRED
   *
   * This is a unique identifier to identify the authentication
   * request made by the Client. It MUST contain sufficient
   * entropy (a minimum of 128 bits while 160 bits is recommended)
   * to make brute force guessing or forgery of a valid auth_req_id
   * computationally infeasible - the means of achieving this are
   * implementation-specific, with possible approaches including
   * secure pseudorandom number generation or cryptographically
   * secured self-contained tokens. The OpenID Provider MUST
   * restrict the characters used to 'A'-'Z', 'a'-'z', '0'-'9',
   * '.', '-' and '_', to reduce the chance of the client
   * incorrectly decoding or re-encoding the auth_req_id; this
   * character set was chosen to allow the server to use unpadded
   * base64url if it wishes. The identifier MUST be treated as
   * opaque by the client.
   */
  authReqId: string;

  /**
   * REQUIRED
   *
   * A JSON number with a positive integer value indicating the
   * expiration time of the "auth_req_id" in seconds since the
   * authentication request was received. A Client calling the
   * token endpoint with an expired auth_req_id will receive an
   * error, see Token Error Response.
   */
  expiresIn: number;

  /**
   * OPTIONAL
   *
   * A JSON number with a positive integer value indicating the
   * minimum amount of time in seconds that the Client MUST wait
   * between polling requests to the token endpoint. This
   * parameter will only be present if the Client is registered
   * to use the Poll or Ping modes. If no value is provided,
   * clients MUST use 5 as the default value.
   */
  interval: number;
};
