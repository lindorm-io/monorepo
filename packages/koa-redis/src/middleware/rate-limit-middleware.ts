import { ClientError } from "@lindorm-io/errors";
import { Middleware } from "@lindorm-io/koa";
import { RedisContext } from "../types";
import { assertRateLimit } from "../handler";
import { get } from "lodash";

interface MiddlewareOptions {
  expiresInSeconds: number;
  keyName: string;
  limit: number;
}

export interface RateLimitMiddlewareOptions {
  fallback?: string;
}

export const rateLimitMiddleware =
  (middlewareOptions: MiddlewareOptions) =>
  (path: string, options: RateLimitMiddlewareOptions = {}): Middleware<RedisContext> =>
  async (ctx, next): Promise<void> => {
    const { expiresInSeconds, keyName, limit } = middlewareOptions;
    const { fallback } = options;

    const value = get(ctx, path) || fallback;

    if (!value) {
      throw new ClientError("Invalid Request", {
        statusCode: ClientError.StatusCode.BAD_REQUEST,
        data: {
          keyName,
        },
        debug: {
          fallback,
          keyName,
          path: path,
          value,
        },
      });
    }

    await assertRateLimit(ctx, {
      expiresInSeconds,
      keyName,
      limit,
      value,
    });

    await next();
  };
