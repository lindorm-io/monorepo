/**
 * LINDORM EXTENSION. One upstream identity provider linked to the subject,
 * behind the lindorm `identity_providers` scope. No RFC counterpart.
 */
export type IdentityProvider = {
  /**
   * wire: `sub` — the subject's identifier AT the upstream provider. It is that
   * provider's `sub`, not a lindorm id, and is only unique within `provider`.
   */
  sub: string;
  /**
   * wire: `provider` — the upstream provider the link is with, e.g. `google` /
   * `github` / `bankid`. NOT a vCard-style `type` (home/work).
   */
  provider: string;
  /** wire: `url` */
  url: string;
  /** wire: `username` */
  username: string;
};
