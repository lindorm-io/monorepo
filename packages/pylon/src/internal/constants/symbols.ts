import { lindormSymbol } from "@lindorm/utils";

export const AUDIT_SOURCE = lindormSymbol("pylon", "source", "audit");

/**
 * The deployment's driver-response cache POLICY — never a storage handle: the
 * entries live in `ctx.cache` like every other evictable row. Its home is
 * `PylonAuthConfig.cache`; this symbol only carries it to the two utilities,
 * because `createAccessTokenMiddleware` is constructed by the consumer and
 * never sees the parsed auth config.
 */
export const AUTH_CACHE_POLICY = lindormSymbol("pylon", "marker", "auth-cache-policy");
