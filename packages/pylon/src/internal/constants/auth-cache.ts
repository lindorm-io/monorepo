import type { ReadableTime } from "@lindorm/date";

/**
 * The built-in introspection-cache TTL — the last of the three tiers (per-mount,
 * then deployment, then this).
 *
 * ⚠ Seconds, deliberately. The TTL IS the revocation window (RFC 7662 §5): the
 * whole point of an opaque token is that the resource server must ask the
 * authorization server often enough for a revocation to propagate. Ten seconds
 * collapses a burst of requests into one introspection without meaningfully
 * extending the life of a revoked token.
 */
export const DEFAULT_INTROSPECTION_CACHE_TTL: ReadableTime = "10 seconds";

/**
 * The built-in userinfo-cache TTL — the last of the two tiers (deployment, then
 * this).
 *
 * ⚠ Minutes, and that is not an oversight. A profile is not an authorization
 * decision, so there is no revocation window to respect here: the credential was
 * already resolved by the time userinfo is asked, and the only cost of a stale
 * entry is a name or picture five minutes behind the provider.
 */
export const DEFAULT_USERINFO_CACHE_TTL: ReadableTime = "5 minutes";
