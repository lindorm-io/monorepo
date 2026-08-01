/**
 * LINDORM EXTENSION. One instant messaging handle, behind the lindorm
 * `instant_messaging` scope. No RFC counterpart.
 */
export type InstantMessaging = {
  /**
   * wire: `provider` — the messaging service the handle belongs to, e.g.
   * `signal` / `whatsapp` / `matrix`. NOT a vCard-style `type` (home/work).
   */
  provider: string;
  /** wire: `url` — canonical link to the handle, e.g. a `t.me` / `wa.me` / `matrix.to` URL. */
  url: string;
  /** wire: `username` */
  username: string;
};
