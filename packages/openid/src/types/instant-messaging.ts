/**
 * LINDORM EXTENSION. One instant messaging handle, behind the lindorm
 * `instant_messaging` scope. No RFC counterpart.
 */
export type InstantMessaging = {
  /** wire: `type` */
  type: string;
  /** wire: `username` */
  username: string;
};
