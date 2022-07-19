import { RedisConnection } from "@lindorm-io/redis";
import { DefaultLindormRedisKoaMiddleware } from "../types";

export const redisMiddleware =
  (connection: RedisConnection): DefaultLindormRedisKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("redis");

    await connection.connect();

    ctx.connection.redis = connection;

    ctx.logger.debug("redis connection added to context");

    metric.end();

    await next();
  };
