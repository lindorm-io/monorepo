import { ClientError } from "@lindorm-io/errors";
import { Middleware } from "@lindorm-io/koa";
import { RedisContext } from "../types";
import { get } from "lodash";
import { assertRateLimitBackoff, clearRateLimitBackoff, setRateLimitBackoff } from "../handler";

interface MiddlewareOptions {
  keyName: string;
}

export const rateLimitBackoffMiddleware =
  (middlewareOptions: MiddlewareOptions) =>
  (path: string): Middleware<RedisContext> =>
  async (ctx, next): Promise<void> => {
    const { keyName } = middlewareOptions;

    const value = get(ctx, path);

    if (!value) {
      throw new ClientError("Invalid Request", {
        statusCode: ClientError.StatusCode.BAD_REQUEST,
        data: {
          keyName,
        },
        debug: {
          keyName,
          path: path,
          value,
        },
      });
    }

    await assertRateLimitBackoff(ctx, { keyName, value });

    try {
      await next();

      await clearRateLimitBackoff(ctx, { keyName, value });
    } catch (err: any) {
      if (err instanceof ClientError) {
        const { retriesLeft, retryIn } = await setRateLimitBackoff(ctx, {
          keyName,
          value,
        });

        if (retryIn) {
          throw new ClientError("Rate Limit", {
            statusCode: ClientError.StatusCode.TOO_MANY_REQUESTS,
            data: { retryIn },
          });
        }

        throw new ClientError(err.message, {
          error: err,
          data: {
            ...(err.data || {}),
            retriesLeft,
          },
        });
      }

      throw err;
    }
  };
