/**
 * Pylon's OWN response headers — namespaced `x-pylon-*` so they cannot collide
 * with a standard one, and listed here ONCE so the code that emits them and the
 * CORS handler that exposes them cannot drift apart.
 *
 * ⚠ A browser cannot read a custom response header that is not named in
 * `Access-Control-Expose-Headers`. These are emitted FOR the client — a cookie
 * session's primary consumer is a browser — so anything added here must be
 * added to `PYLON_EXPOSED_HEADERS` below, and anything emitted for the client
 * must be added here.
 */
export const PYLON_CACHE_HEADER = "X-Pylon-Cache";
export const PYLON_CACHE_SOURCE_HEADER = "X-Pylon-Cache-Source";
export const PYLON_SESSION_REFRESHED_HEADER = "X-Pylon-Session-Refreshed";
export const PYLON_SESSION_EXPIRES_AT_HEADER = "X-Pylon-Session-Expires-At";

/**
 * Lowercased because `Access-Control-Expose-Headers` is compared
 * case-insensitively and the CORS middleware already lowercases the
 * deployment's own `exposeHeaders`, so one casing keeps de-duplication honest.
 */
export const PYLON_EXPOSED_HEADERS: Array<string> = [
  PYLON_CACHE_HEADER,
  PYLON_CACHE_SOURCE_HEADER,
  PYLON_SESSION_REFRESHED_HEADER,
  PYLON_SESSION_EXPIRES_AT_HEADER,
].map((header) => header.toLowerCase());
