import { isBefore, isLive, type ReadableTime, ms } from "@lindorm/date";
import type { IProteusSource } from "@lindorm/proteus";
import type { PylonHttpContext, PylonIntrospection } from "../../../types/index.js";
import { DEFAULT_INTROSPECTION_CACHE_TTL } from "../../constants/introspection.js";
import { INTROSPECTION_SOURCE } from "../../constants/symbols.js";
import { buildIntrospectionCacheKey } from "./build-introspection-cache-key.js";
import { fromCachedPayload } from "./from-cached-payload.js";
import { toCachedPayload } from "./to-cached-payload.js";

/**
 * The deployment's introspection-cache wiring, attached to the context by the
 * dependencies middleware. Present ONLY when `introspection.enabled` is set and
 * a key-value source resolved — its absence is what turns the cache off.
 */
export type IntrospectionCacheConfig = {
  kv: IProteusSource;
  ttl?: ReadableTime;
};

/** Per-mount override. `false` turns the cache off for this mount alone. */
export type IntrospectionCacheOptions = false | { ttl?: ReadableTime };

/**
 * `ctx.auth.introspect` with a short-lived shared cache in front of it.
 *
 * ⚠ The TTL IS the revocation window. RFC 7662 §5 warns that caching opens "a
 * window during which a revoked token could be used at the protected resource",
 * so the TTL is measured in SECONDS — for active and inactive answers alike.
 * Caching to the token's own `exp` would make the window the entire token
 * lifetime, i.e. an opaque token behaving like an unrevocable JWT.
 *
 * Three-tier TTL: per-mount `cache.ttl`, else the deployment default, else ten
 * seconds. Everything else fails OPEN to an uncached introspection — no source,
 * no client identity to key on, or a storage outage must never fail a request.
 * Only the introspection call itself propagates its error: serving a stale
 * answer over an unreachable authorization server is a revocation bypass.
 */
export const introspectWithCache = async (
  ctx: PylonHttpContext,
  token: string,
  cache: IntrospectionCacheOptions | undefined,
): Promise<PylonIntrospection> => {
  const config = (ctx as any)[INTROSPECTION_SOURCE] as
    | IntrospectionCacheConfig
    | undefined;

  // Off for this mount (the sensitive-route carve-out), or off for the
  // deployment (no `introspection` block, or no key-value source to store in).
  if (cache === false || !config) return ctx.auth.introspect(token);

  // The response is a function of (token, authorization server, requesting
  // client) — RFC 7662 §2.2. Without the latter two there is no key that is safe
  // to share, so the cache steps aside rather than key on the token alone.
  const identity = ctx.auth.config;

  if (!identity) {
    ctx.logger.debug("Introspection cache skipped: auth client exposes no identity");
    return ctx.auth.introspect(token);
  }

  const ttlMs = ms(cache?.ttl ?? config.ttl ?? DEFAULT_INTROSPECTION_CACHE_TTL);
  const key = buildIntrospectionCacheKey({
    token,
    issuer: identity.issuer,
    clientId: identity.clientId,
  });

  // Dynamically import the entity so the static module graph from index.js stays
  // free of @lindorm/proteus (iris/proteus optionality).
  const { CachedIntrospection } =
    await import("../../../entities/CachedIntrospection.js");
  const repository = config.kv
    .session({ logger: ctx.logger })
    .repository(CachedIntrospection);

  try {
    const entry = await repository.findOne({ id: key });

    if (entry) {
      // BOTH bounds must hold: the entry's own expiry, AND this mount's TTL
      // measured from when the entry was written. Mounts share one key, so a
      // two-second carve-out would otherwise be served a sixty-second entry
      // written by a lenient mount — a revocation window it never agreed to.
      const live = !entry.expiresAt || isLive(entry.expiresAt);
      const withinTtl = isLive(new Date(entry.updatedAt.getTime() + ttlMs));

      if (live && withinTtl) {
        ctx.logger.debug("Introspection cache hit", { active: entry.payload.active });
        return fromCachedPayload(entry.payload);
      }
    }
  } catch (error: any) {
    ctx.logger.warn("Introspection cache read failed; introspecting", { error });
  }

  // A failure here propagates untouched — nothing is written, and no earlier
  // answer is served in its place.
  const introspection = await ctx.auth.introspect(token);

  const expiresAt = new Date(Date.now() + ttlMs);
  // An entry must never outlive the credential it describes.
  const bounded =
    introspection.active &&
    introspection.expiresAt &&
    isBefore(introspection.expiresAt, expiresAt)
      ? introspection.expiresAt
      : expiresAt;

  if (isLive(bounded)) {
    try {
      await repository.upsert({
        id: key,
        payload: toCachedPayload(introspection),
        expiresAt: bounded,
      } as any);
    } catch (error: any) {
      ctx.logger.warn("Introspection cache write failed", { error });
    }
  }

  return introspection;
};
