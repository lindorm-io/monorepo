import { ConduitMiddleware, ConduitResponse } from "../types";

type Config = {
  maxAge?: number;
  maxEntries?: number;
};

type CacheEntry = {
  response: ConduitResponse;
  timestamp: number;
};

export const createConduitCacheMiddleware = (config: Config = {}): ConduitMiddleware => {
  const maxAge = config.maxAge ?? 300000;
  const maxEntries = config.maxEntries ?? 1000;

  const cache = new Map<string, CacheEntry>();

  return async function conduitCacheMiddleware(ctx, next) {
    const method = ctx.req.config.method;

    if (method !== "GET") {
      await next();
      return;
    }

    const key = `${method}:${ctx.req.url}:${JSON.stringify(ctx.req.query)}`;

    const existing = cache.get(key);
    if (existing && Date.now() - existing.timestamp < maxAge) {
      ctx.res = { ...existing.response };
      return;
    }

    await next();

    const cacheControl = ctx.res.headers?.["cache-control"];
    const ccValue = typeof cacheControl === "string" ? cacheControl : "";

    if (ccValue.includes("no-cache") || ccValue.includes("no-store")) {
      return;
    }

    if (ctx.res.status >= 200 && ctx.res.status < 300) {
      if (cache.size >= maxEntries) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) {
          cache.delete(oldest);
        }
      }

      cache.set(key, {
        response: { ...ctx.res },
        timestamp: Date.now(),
      });
    }
  };
};
