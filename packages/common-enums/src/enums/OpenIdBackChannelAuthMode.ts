export enum OpenIdBackchannelAuthMode {
  /**
   * When configured in Ping mode, the OP will send a request
   * to a callback URI previously registered by the Client with
   * the unique identifier returned from the Backchannel
   * Authentication Endpoint. Upon receipt of the notification,
   * the Client makes a request to the token endpoint to obtain
   * the tokens.
   */
  PING = "ping",

  /**
   * When configured in Poll mode, the Client will poll the
   * token endpoint to get a response with the tokens.
   */
  POLL = "poll",

  /**
   * When configured in Push mode, the OP will send a request
   * with the tokens to a callback URI previously registered
   * by the Client.
   */
  PUSH = "push",
}
