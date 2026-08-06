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
