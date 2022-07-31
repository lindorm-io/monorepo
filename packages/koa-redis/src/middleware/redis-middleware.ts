import { IRedisConnection } from "@lindorm-io/redis";
import { DefaultLindormRedisKoaMiddleware } from "../types";
import { ServerError } from "@lindorm-io/errors";

export const redisMiddleware =
  (connection: IRedisConnection): DefaultLindormRedisKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("redis");

    if (!connection.isConnected) {
      throw new ServerError("Server is not connected to redis");
    }

    ctx.connection.redis = connection;

    ctx.logger.debug("redis connection added to context");

    metric.end();

    await next();
  };
