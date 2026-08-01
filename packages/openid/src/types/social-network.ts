/**
 * LINDORM EXTENSION. One social network profile, behind the lindorm
 * `social_networks` scope. No RFC counterpart.
 */
export type SocialNetwork = {
  /** wire: `type` */
  type: string;
  /** wire: `url` */
  url: string;
  /** wire: `username` */
  username: string;
};
