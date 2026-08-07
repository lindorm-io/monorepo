import { isBefore, isLive, ms } from "@lindorm/date";
import type {
  PylonAuthCacheEntry,
  PylonContext,
  PylonIntrospection,
} from "../../../types/index.js";
import { DEFAULT_INTROSPECTION_CACHE_TTL } from "../../constants/auth-cache.js";
import { buildAuthCacheKey } from "./build-auth-cache-key.js";
import { fromCachedIntrospection } from "./from-cached-introspection.js";
import { toCachedIntrospection } from "./to-cached-introspection.js";

type Options = {
  /** The per-call carve-out. `false` introspects for this call whatever the
   *  deployment configured; `{ ttl }` shortens the window. */
  cache: PylonAuthCacheEntry | undefined;
  /** The uncached driver call, invoked on a miss and on every degraded path. */
  fetch: () => Promise<PylonIntrospection>;
};

/**
 * The short-lived shared cache built INTO `ctx.auth.introspect`. Not a wrapper a
 * caller may choose: there is one introspect, and this is the part of it that
 * remembers.
 *
 * ⚠ The TTL IS the revocation window. RFC 7662 §5 warns that caching opens "a
 * window during which a revoked token could be used at the protected resource",
 * so the TTL is measured in SECONDS — for active and inactive answers alike.
 * Caching to the token's own `exp` would make the window the entire token
 * lifetime, i.e. an opaque token behaving like an unrevocable JWT.
 *
 * Three-tier TTL: per-call `cache.ttl`, else `auth.cache.introspection.ttl`,
 * else ten seconds. Everything else fails OPEN to an uncached introspection — no
 * source, no client identity to key on, or a storage outage must never fail a
 * request. Only the introspection call itself propagates its error: serving a
 * stale answer over an unreachable authorization server is a revocation bypass.
 */
export const cacheIntrospection = async (
  ctx: PylonContext,
  token: string,
  options: Options,
): Promise<PylonIntrospection> => {
  const { auth } = ctx.state.app.config;

  // Off for this call (the sensitive-route carve-out), off for introspection
  // specifically (`cache.introspection: false`, userinfo unaffected), or off for
  // the deployment (no `auth.cache` block, or no `auth` block at all).
  if (options.cache === false || !auth || auth.cache === false) {
    return options.fetch();
  }

  if (auth.cache.introspection === false) return options.fetch();

  // No evictable source in this deployment: keep introspecting, uncached and
  // without error. Read AFTER the switches so an off deployment never opens a
  // session it has no use for.
  if (!ctx.cache) return options.fetch();

  // The response is a function of (token, authorization server, requesting
  // client) — RFC 7662 §2.2. ⚠ Both come from the DRIVER, which is the party
  // that authenticates to the introspection endpoint; RFC 7662 §2.1 has that be
  // the resource server, whose credentials may legitimately differ from a
  // relying party's. Without them there is no key that is safe to share, so the
  // cache steps aside rather than key on the token alone.
  const { clientId, issuer } = auth;

  if (!issuer || !clientId) {
    ctx.logger.debug("Introspection cache skipped: auth exposes no identity", {
      clientId,
      issuer,
    });
    return options.fetch();
  }

  const ttlMs = ms(
    options.cache?.ttl ??
      auth.cache.introspection?.ttl ??
      DEFAULT_INTROSPECTION_CACHE_TTL,
  );
  const key = buildAuthCacheKey({ kind: "introspection", token, issuer, clientId });

  // Dynamically import the entity so the static module graph from index.js stays
  // free of @lindorm/proteus (iris/proteus optionality).
  const { CachedIntrospection } =
    await import("../../../entities/CachedIntrospection.js");
  const repository = ctx.cache.repository(CachedIntrospection);

  try {
    const entry = await repository.findOne({ id: key });

    if (entry) {
      // BOTH bounds must hold: the entry's own expiry, AND this call's TTL
      // measured from when the entry was written. Callers share one key, so a
      // two-second carve-out would otherwise be served a sixty-second entry
      // written by a lenient one — a revocation window it never agreed to.
      const live = !entry.expiresAt || isLive(entry.expiresAt);
      const withinTtl = isLive(new Date(entry.updatedAt.getTime() + ttlMs));

      if (live && withinTtl) {
        ctx.logger.debug("Introspection cache hit", { active: entry.payload.active });
        return fromCachedIntrospection(entry.payload);
      }
    }
  } catch (error: any) {
    ctx.logger.warn("Introspection cache read failed; introspecting", { error });
  }

  // A failure here propagates untouched — nothing is written, and no earlier
  // answer is served in its place.
  const introspection = await options.fetch();

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
        payload: toCachedIntrospection(introspection),
        expiresAt: bounded,
      } as any);
    } catch (error: any) {
      ctx.logger.warn("Introspection cache write failed", { error });
    }
  }

  return introspection;
};
