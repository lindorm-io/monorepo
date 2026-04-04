import { ReadableTime, ms } from "@lindorm/date";
import { ClientError } from "@lindorm/errors";
import { IProteusSource } from "@lindorm/proteus";
import { isHttpContext, isSocketContext } from "#internal/utils/is-context";
import { resolveProteus } from "#internal/utils/resolve-proteus";
import { fixedWindowStrategy } from "#internal/utils/rate-limit/fixed-window-strategy";
import { RateLimitResult } from "#internal/utils/rate-limit/fixed-window-strategy";
import { slidingWindowStrategy } from "#internal/utils/rate-limit/sliding-window-strategy";
import { tokenBucketStrategy } from "#internal/utils/rate-limit/token-bucket-strategy";
import { RateLimitBucket, RateLimitFixed, RateLimitSliding } from "../../entities";
import { PylonContext, PylonMiddleware } from "../../types";

type RateLimitStrategy = "fixed" | "sliding" | "token-bucket";

type RateLimitOptions = {
  window: ReadableTime | number;
  max: number;
  strategy?: RateLimitStrategy;
  key?: (ctx: PylonContext) => string;
  skip?: (ctx: PylonContext) => boolean;
  proteus?: IProteusSource;
};

const resolveKey = (ctx: PylonContext): string => {
  if (isHttpContext(ctx)) {
    return ctx.request.ip ?? "unknown";
  }
  if (isSocketContext(ctx)) {
    return ctx.socket.id ?? "unknown";
  }
  return "unknown";
};

const executeStrategy = async (
  source: IProteusSource,
  strategy: RateLimitStrategy,
  key: string,
  windowMs: number,
  max: number,
): Promise<RateLimitResult> => {
  switch (strategy) {
    case "fixed":
      return fixedWindowStrategy(source.repository(RateLimitFixed), key, windowMs, max);
    case "sliding":
      return slidingWindowStrategy(
        source.repository(RateLimitSliding),
        key,
        windowMs,
        max,
      );
    case "token-bucket":
      return tokenBucketStrategy(source.repository(RateLimitBucket), key, windowMs, max);
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

    const source = resolveProteus(ctx, options.proteus);
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
