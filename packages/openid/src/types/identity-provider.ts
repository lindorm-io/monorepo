/**
 * LINDORM EXTENSION. One upstream identity provider linked to the subject,
 * behind the lindorm `identity_providers` scope. No RFC counterpart.
 */
export type IdentityProvider = {
  /** wire: `id` */
  id: string;
  /** wire: `type` */
  type: string;
  /** wire: `username` */
  username: string;
  /** wire: `url` */
  url: string;
};
