/**
 * LINDORM EXTENSION. One upstream identity provider linked to the subject,
 * behind the lindorm `identity_providers` scope. No RFC counterpart.
 */
export type IdentityProvider = {
  /** wire: `id` — the subject's identifier AT the upstream provider (its `sub`). */
  id: string;
  /**
   * wire: `provider` — the upstream provider the link is with, e.g. `google` /
   * `github` / `bankid`. NOT a vCard-style `type` (home/work).
   */
  provider: string;
  /** wire: `username` */
  username: string;
  /** wire: `url` */
  url: string;
};
