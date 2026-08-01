/**
 * LINDORM EXTENSION. One social network profile, behind the lindorm
 * `social_networks` scope. No RFC counterpart.
 */
export type SocialNetwork = {
  /**
   * wire: `provider` — the network the profile lives on, e.g. `mastodon` /
   * `linkedin` / `bluesky`. NOT a vCard-style `type` (home/work).
   */
  provider: string;
  /** wire: `url` */
  url: string;
  /** wire: `username` */
  username: string;
};
