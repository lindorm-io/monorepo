import type { HttpMethod } from "@lindorm/types";
import { createMemoryCacheDriver } from "../drivers/index.js";
import { canonicalCacheKey } from "../internal/utils/canonical-cache-key.js";
import type { IConduitCacheDriver } from "../interfaces/index.js";
import type {
  ConduitCacheKey,
  ConduitMiddleware,
  ConduitResponse,
} from "../types/index.js";

export type ConduitCacheConfig = {
  /** Cache driver; defaults to an in-memory LRU driver. */
  driver?: IConduitCacheDriver;
  /** Entry TTL in milliseconds. Omit for no expiry. */
  maxAge?: number;
  /** Methods to cache. Defaults to GET only. */
  methods?: Array<HttpMethod>;
  /** Honour a response `Cache-Control: no-store`/`no-cache`. Default true. */
  respectCacheControl?: boolean;
  /** When true, a miss throws instead of performing the request. */
  offline?: boolean;
};

export const createConduitCacheMiddleware = (
  config: ConduitCacheConfig = {},
): ConduitMiddleware => {
  const driver = config.driver ?? createMemoryCacheDriver();
  const maxAge = config.maxAge;
  const methods = (config.methods ?? ["GET"]).map((m) => m.toUpperCase());
  const respectCacheControl = config.respectCacheControl ?? true;
  const offline = config.offline ?? false;

  // Coalesces concurrent identical misses: one request fetches, the rest await.
  const inflight = new Map<string, Promise<ConduitResponse>>();

  return async function conduitCacheMiddleware(ctx, next) {
    const method = ctx.req.config.method;

    if (!methods.includes(method.toUpperCase())) {
      await next();
      return;
    }

    const key: ConduitCacheKey = {
      method,
      url: ctx.req.url,
      query: ctx.req.query,
      body: ctx.req.body,
    };

    const hit = await driver.get(key);

    if (hit) {
      ctx.res = {
        ...hit.response,
        headers: {
          ...hit.response.headers,
          "x-conduit-cache-middleware": "HIT",
          age: Math.floor((Date.now() - hit.storedAt) / 1000),
        },
      };

      return;
    }

    if (offline) {
      throw new Error(`Conduit cache miss in offline mode: ${method} ${ctx.req.url}`);
    }

    const id = canonicalCacheKey(key);
    const pending = inflight.get(id);

    if (pending) {
      const shared = await pending;
      ctx.res = {
        ...shared,
        headers: { ...shared.headers, "x-conduit-cache-middleware": "MISS" },
      };

      return;
    }

    const run = (async (): Promise<ConduitResponse> => {
      await next();

      const cacheControl = ctx.res.headers?.["cache-control"];
      const ccValue = typeof cacheControl === "string" ? cacheControl : "";
      const blocked =
        respectCacheControl &&
        (ccValue.includes("no-store") || ccValue.includes("no-cache"));

      if (!blocked && ctx.res.status >= 200 && ctx.res.status < 300) {
        await driver.set(key, ctx.res, maxAge);
      }

      return ctx.res;
    })();

    inflight.set(id, run);

    try {
      await run;
    } finally {
      inflight.delete(id);
    }

    ctx.res.headers = { ...ctx.res.headers, "x-conduit-cache-middleware": "MISS" };
  };
};
