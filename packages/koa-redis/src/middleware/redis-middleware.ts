import { Middleware } from "@lindorm-io/koa";
import { RedisConnection } from "@lindorm-io/redis";
import { RedisContext } from "../types";

export const redisMiddleware =
  (connection: RedisConnection): Middleware<RedisContext> =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("redis");

    await connection.waitForConnection();

    ctx.connection.redis = connection;

    ctx.logger.debug("redis connection added to context");

    metric.end();

    await next();
  };
