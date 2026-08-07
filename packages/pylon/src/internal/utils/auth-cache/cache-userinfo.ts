import { isLive, ms } from "@lindorm/date";
import type { PylonContext, PylonUserinfo } from "../../../types/index.js";
import { DEFAULT_USERINFO_CACHE_TTL } from "../../constants/auth-cache.js";
import { buildAuthCacheKey } from "./build-auth-cache-key.js";

type Options = {
  /** The uncached driver call, invoked on a miss and on every degraded path. */
  fetch: () => Promise<PylonUserinfo>;
};

/**
 * The shared cache built INTO `ctx.auth.userinfo` (OIDC Core §5.3). Not a
 * wrapper a caller may choose: there is one userinfo, and this is the part of it
 * that remembers.
 *
 * ⚠ Unlike introspection, the TTL here is a STALENESS TOLERANCE, not a
 * revocation window — a profile is not an authorization decision, and by the
 * time userinfo is asked the credential has already been resolved. Hence minutes
 * rather than seconds. Two tiers: `auth.cache.userinfo.ttl`, else five minutes.
 *
 * ⚠ Nothing negative is ever cached. Userinfo returns a profile or it errors,
 * and storing the error would serve a stale failure after its cause cleared;
 * "is this token still good?" is introspection's question, under introspection's
 * far shorter window. A failure propagates untouched and writes nothing.
 *
 * Everything else fails OPEN to an uncached fetch — no source, no client
 * identity to key on, or a storage outage must never fail a request.
 */
export const cacheUserinfo = async (
  ctx: PylonContext,
  token: string,
  options: Options,
): Promise<PylonUserinfo> => {
  const { auth } = ctx.state.app.config;

  // Off for userinfo specifically (`cache.userinfo: false`, introspection
  // unaffected), or off for the deployment (no `auth.cache` block, or no `auth`
  // block at all).
  if (!auth || auth.cache === false) return options.fetch();
  if (auth.cache.userinfo === false) return options.fetch();

  // No evictable source in this deployment: keep fetching, uncached and without
  // error. Read AFTER the switches so an off deployment never opens a session it
  // has no use for.
  if (!ctx.cache) return options.fetch();

  // The response is a function of (token, provider, requesting client). Without
  // the last two there is no key that is safe to share, so the cache steps aside
  // rather than key on the token alone.
  const { clientId, issuer } = auth;

  if (!issuer || !clientId) {
    ctx.logger.debug("Userinfo cache skipped: auth exposes no identity", {
      clientId,
      issuer,
    });
    return options.fetch();
  }

  const ttlMs = ms(auth.cache.userinfo?.ttl ?? DEFAULT_USERINFO_CACHE_TTL);
  const key = buildAuthCacheKey({ kind: "userinfo", token, issuer, clientId });

  // Dynamically import the entity so the static module graph from index.js stays
  // free of @lindorm/proteus (iris/proteus optionality).
  const { CachedUserinfo } = await import("../../../entities/CachedUserinfo.js");
  const repository = ctx.cache.repository(CachedUserinfo);

  try {
    const entry = await repository.findOne({ id: key });

    if (entry) {
      // BOTH bounds must hold: the entry's own expiry, AND the TTL in force NOW
      // measured from when the entry was written — so lowering the deployment's
      // tolerance takes effect against entries a longer one already wrote.
      const live = !entry.expiresAt || isLive(entry.expiresAt);
      const withinTtl = isLive(new Date(entry.updatedAt.getTime() + ttlMs));

      if (live && withinTtl) {
        ctx.logger.debug("Userinfo cache hit");
        return entry.payload.claims;
      }
    }
  } catch (error: any) {
    ctx.logger.warn("Userinfo cache read failed; fetching userinfo", { error });
  }

  // A failure here propagates untouched — nothing is written, and no earlier
  // answer is served in its place.
  const userinfo = await options.fetch();

  try {
    await repository.upsert({
      id: key,
      // The DOMAIN object verbatim: the column is `@TypedJson`, so a `Date`
      // survives as a `Date` and no claim translation can drop anything.
      payload: { claims: userinfo },
      expiresAt: new Date(Date.now() + ttlMs),
    } as any);
  } catch (error: any) {
    ctx.logger.warn("Userinfo cache write failed", { error });
  }

  return userinfo;
};
