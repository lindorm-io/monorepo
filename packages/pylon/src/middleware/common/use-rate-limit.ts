import { type ReadableTime, ms } from "@lindorm/date";
import { ClientError, ServerError } from "@lindorm/errors";
import type { IProteusSession } from "@lindorm/proteus";
import { isHttpContext, isSocketContext } from "../../internal/utils/is-context.js";
import { fixedWindowStrategy } from "../../internal/utils/rate-limit/fixed-window-strategy.js";
import type { RateLimitResult } from "../../internal/utils/rate-limit/fixed-window-strategy.js";
import { slidingWindowStrategy } from "../../internal/utils/rate-limit/sliding-window-strategy.js";
import { tokenBucketStrategy } from "../../internal/utils/rate-limit/token-bucket-strategy.js";
import type { PylonContext, PylonMiddleware } from "../../types/index.js";

type RateLimitStrategy = "fixed" | "sliding" | "token-bucket";

type RateLimitOptions = {
  window: ReadableTime | number;
  max: number;
  strategy?: RateLimitStrategy;
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
  strategy: RateLimitStrategy,
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

export const useRateLimit = (options: RateLimitOptions): PylonMiddleware => {
  const strategy: RateLimitStrategy = options.strategy ?? "fixed";
  const windowMs =
    typeof options.window === "number" ? options.window : ms(options.window);

  return async function useRateLimitMiddleware(ctx: PylonContext, next) {
    // Disabled by app config: silently pass through, never throw. The
    // source-missing throw below only fires when rate limiting IS enabled.
    if (ctx.state.app.config.rateLimit === false) {
      await next();
      return;
    }

    if (options.skip?.(ctx)) {
      await next();
      return;
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
        details:
          "Enable rate limiting in PylonSettings with rateLimit: { enabled: true } before using useRateLimit",
        debug: { strategy },
      });
    }

    const key = options.key?.(ctx) ?? resolveKey(ctx);
    const result = await executeStrategy(ctx.cache, strategy, key, windowMs, options.max);

    if (isHttpContext(ctx)) {
      ctx.set("X-RateLimit-Limit", String(options.max));
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
          limit: options.max,
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
