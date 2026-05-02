import { type ReadableTime, ms } from "@lindorm/date";
import { ClientError, ServerError } from "@lindorm/errors";
import type { IProteusSession, IProteusSource } from "@lindorm/proteus";
import { RATE_LIMIT_SOURCE } from "../../internal/constants/symbols.js";
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
  source: IProteusSession,
  strategy: RateLimitStrategy,
  key: string,
  windowMs: number,
  max: number,
): Promise<RateLimitResult> => {
  switch (strategy) {
    case "fixed": {
      const { RateLimitFixed } = await import("../../entities/RateLimitFixed.js");
      return fixedWindowStrategy(source.repository(RateLimitFixed), key, windowMs, max);
    }
    case "sliding": {
      const { RateLimitSliding } = await import("../../entities/RateLimitSliding.js");
      return slidingWindowStrategy(
        source.repository(RateLimitSliding),
        key,
        windowMs,
        max,
      );
    }
    case "token-bucket": {
      const { RateLimitBucket } = await import("../../entities/RateLimitBucket.js");
      return tokenBucketStrategy(source.repository(RateLimitBucket), key, windowMs, max);
    }
  }
};

export const useRateLimit = (options: RateLimitOptions): PylonMiddleware => {
  const strategy: RateLimitStrategy = options.strategy ?? "fixed";
  const windowMs =
    typeof options.window === "number" ? options.window : ms(options.window);

  return async function useRateLimitMiddleware(ctx: PylonContext, next) {
    if (options.skip?.(ctx)) {
      await next();
      return;
    }

    const rawSource = (ctx as any)[RATE_LIMIT_SOURCE] as IProteusSource | undefined;
    if (!rawSource) {
      throw new ServerError(
        "Rate limiting is not configured. Enable it in PylonOptions with rateLimit: { enabled: true }",
      );
    }

    const source = rawSource.session({ logger: ctx.logger });
    const key = options.key?.(ctx) ?? resolveKey(ctx);
    const result = await executeStrategy(source, strategy, key, windowMs, options.max);

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
        status: 429,
        code: "rate_limit_exceeded",
        data: {
          limit: options.max,
          remaining: result.remaining,
          resetAt: result.resetAt.toISOString(),
          retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
        },
      });
    }

    await next();
  };
};
