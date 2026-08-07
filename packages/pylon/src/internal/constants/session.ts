/**
 * The session cookie's name — fixed, not configurable. Pylon's other two cookie
 * names (`pylon_login_session`, `pylon_logout_session`, see `parseAuthConfig`)
 * never were either, and the collision case a configurable name would answer —
 * two pylons on one domain — is not solved by making one of the three settable.
 */
export const SESSION_COOKIE_NAME = "pylon_session";
