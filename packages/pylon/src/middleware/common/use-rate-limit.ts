import { type ReadableTime, ms } from "@lindorm/date";
import { ClientError, ServerError } from "@lindorm/errors";
import { isNumber } from "@lindorm/is";
import type { IProteusSession } from "@lindorm/proteus";
import { isHttpContext, isSocketContext } from "../../internal/utils/is-context.js";
import { fixedWindowStrategy } from "../../internal/utils/rate-limit/fixed-window-strategy.js";
import type { RateLimitResult } from "../../internal/utils/rate-limit/fixed-window-strategy.js";
import { slidingWindowStrategy } from "../../internal/utils/rate-limit/sliding-window-strategy.js";
import { tokenBucketStrategy } from "../../internal/utils/rate-limit/token-bucket-strategy.js";
import type {
  PylonContext,
  PylonMiddleware,
  PylonRateLimitStrategy,
} from "../../types/index.js";

/**
 * A mount's OWN limits, each narrowing the deployment policy on
 * `ctx.state.app.config.rateLimit`. Every member is optional because the
 * deployment already stated all five — `useRateLimit()` with no arguments IS the
 * deployment's limit, which is how the globally mounted one is installed.
 */
type RateLimitOptions = {
  window?: ReadableTime | number;
  max?: number;
  strategy?: PylonRateLimitStrategy;
  key?: (ctx: PylonContext) => string;
  skip?: (ctx: PylonContext) => boolean;
};

const resolveKey = (ctx: PylonContext): string => {
  if (isHttpContext(ctx)) {
    return ctx.request.ip ?? "unknown";
  }
  if (isSocketContext(ctx)) {
    return ctx.io.socket.id ?? "unknown";
  }
  return "unknown";
};

const executeStrategy = async (
  session: IProteusSession,
  strategy: PylonRateLimitStrategy,
  key: string,
  windowMs: number,
  max: number,
): Promise<RateLimitResult> => {
  switch (strategy) {
    case "fixed": {
      const { RateLimitFixed } = await import("../../entities/RateLimitFixed.js");
      return fixedWindowStrategy(session.repository(RateLimitFixed), key, windowMs, max);
    }
    case "sliding": {
      const { RateLimitSliding } = await import("../../entities/RateLimitSliding.js");
      return slidingWindowStrategy(
        session.repository(RateLimitSliding),
        key,
        windowMs,
        max,
      );
    }
    case "token-bucket": {
      const { RateLimitBucket } = await import("../../entities/RateLimitBucket.js");
      return tokenBucketStrategy(session.repository(RateLimitBucket), key, windowMs, max);
    }
  }
};

export const useRateLimit = (options: RateLimitOptions = {}): PylonMiddleware => {
  // Resolved once: a mount's window is a fixed duration, whatever spelling it
  // arrived in, and the deployment's is already milliseconds.
  const mountWindowMs =
    options.window === undefined
      ? null
      : isNumber(options.window)
        ? options.window
        : ms(options.window);

  return async function useRateLimitMiddleware(ctx: PylonContext, next) {
    // Disabled by app config: silently pass through, never throw. The throws
    // below only fire when rate limiting IS enabled.
    const config = ctx.state.app.config.rateLimit;

    if (config === false) {
      await next();
      return;
    }

    // A mount states its own skip or inherits the deployment's — the same
    // narrowing every other member gets, so "never rate-limit health checks"
    // is stated once.
    const skip = options.skip ?? config.skip;

    if (skip?.(ctx)) {
      await next();
      return;
    }

    const strategy = options.strategy ?? config.strategy;
    const windowMs = mountWindowMs ?? config.window;
    const max = options.max ?? config.max;

    if (windowMs === null || max === null) {
      throw new ServerError("Rate limiting has no window or ceiling to apply", {
        code: "rate_limit_not_bounded",
        type: "urn:lindorm:pylon:error:rate_limit_not_bounded",
        title: "Rate Limit Not Bounded",
        details:
          "Rate limiting is enabled but neither this mount nor PylonSettings names both a `window` and a `max`. State them on the mount, or set rateLimit.window and rateLimit.max for the deployment.",
        debug: { max, strategy, windowMs },
      });
    }

    // The evictable per-request session, installed whenever a `cache` (or the
    // `kv` fallback) source is configured — INDEPENDENT of `rateLimit.enabled`,
    // which is the `ctx.state.app.config.rateLimit` check above. Read after the
    // disabled/skip guards so a skipped request never opens a session.
    if (!ctx.cache) {
      throw new ServerError("Rate limiting is not configured", {
        code: "rate_limit_not_configured",
        type: "urn:lindorm:pylon:error:rate_limit_not_configured",
        title: "Rate Limit Not Configured",
        // ⚠ `rateLimit` is already enabled here — the config guard above
        // returned otherwise — so naming that switch would send the operator to
        // set something already set. What is missing is the STORE.
        details:
          "Rate limiting is enabled but no evictable source is attached, so there is nowhere to keep the counters. Give PylonSettings a `cache` source (or a `kv` source, which `cache` falls back to) before using useRateLimit",
        debug: { strategy },
      });
    }

    const key = (options.key ?? config.key)?.(ctx) ?? resolveKey(ctx);
    const result = await executeStrategy(ctx.cache, strategy, key, windowMs, max);

    if (isHttpContext(ctx)) {
      ctx.set("X-RateLimit-Limit", String(max));
      ctx.set("X-RateLimit-Remaining", String(result.remaining));
      ctx.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt.getTime() / 1000)));
      ctx.set("X-RateLimit-Strategy", strategy);
    }

    if (!result.allowed) {
      if (isHttpContext(ctx)) {
        const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
        ctx.set("Retry-After", String(retryAfter));
      }

      throw new ClientError("Rate limit exceeded", {
        status: ClientError.Status.TooManyRequests,
        code: "rate_limit_exceeded",
        type: "urn:lindorm:pylon:error:rate_limit_exceeded",
        title: "Rate Limit Exceeded",
        details: `Too many requests; retry after ${Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)} seconds`,
        data: {
          limit: max,
          remaining: result.remaining,
          resetAt: result.resetAt.toISOString(),
          retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
          strategy,
        },
      });
    }

    await next();
  };
};
