import { ConduitError } from "../errors";
import { ConduitMiddleware } from "../types";

type Config = {
  maxRequests?: number;
  windowMs?: number;
  perOrigin?: boolean;
};

type Bucket = {
  tokens: number;
  lastRefill: number;
};

export const createConduitRateLimitMiddleware = (
  config: Config = {},
): ConduitMiddleware => {
  const maxRequests = config.maxRequests ?? 100;
  const windowMs = config.windowMs ?? 60000;
  const perOrigin = config.perOrigin ?? true;

  const buckets = new Map<string, Bucket>();

  const refillRate = maxRequests / windowMs;

  return async function conduitRateLimitMiddleware(ctx, next) {
    let key: string;

    if (perOrigin) {
      try {
        key = new URL(ctx.req.url, ctx.app?.baseURL ?? undefined).origin;
      } catch {
        key = ctx.req.url;
      }
    } else {
      key = "__global__";
    }

    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket) {
      bucket = { tokens: maxRequests, lastRefill: now };
      buckets.set(key, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(maxRequests, bucket.tokens + elapsed * refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      throw new ConduitError("Rate limit exceeded", { status: 429 });
    }

    bucket.tokens -= 1;

    if (buckets.size > 10000) {
      const cutoff = now - windowMs * 2;
      for (const [k, v] of buckets.entries()) {
        if (v.lastRefill < cutoff) {
          buckets.delete(k);
        }
      }
    }

    await next();
  };
};
