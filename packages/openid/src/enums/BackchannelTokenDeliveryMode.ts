/**
 * OpenID Connect CIBA Core 1.0 §4 token delivery modes. A CLOSED set — the
 * spec defines exactly these three.
 */
export const BackchannelTokenDeliveryMode = {
  /**
   * wire: `ping` — the OP notifies a registered callback URI with the
   * `auth_req_id`; the client then calls the token endpoint.
   */
  Ping: "ping",
  /** wire: `poll` — the client polls the token endpoint for the tokens. */
  Poll: "poll",
  /** wire: `push` — the OP pushes the tokens to a registered callback URI. */
  Push: "push",
} as const;

export type BackchannelTokenDeliveryMode =
  (typeof BackchannelTokenDeliveryMode)[keyof typeof BackchannelTokenDeliveryMode];
