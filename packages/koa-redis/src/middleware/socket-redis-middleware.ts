import { RedisConnection } from "@lindorm-io/redis";
import { DefaultLindormRedisSocketMiddleware } from "../types";
import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";

export const socketRedisMiddleware = (
  connection: RedisConnection,
): DefaultLindormRedisSocketMiddleware =>
  promisifyLindormSocketMiddleware(async (socket) => {
    await connection.waitForConnection();
    socket.ctx.connection.redis = connection;

    socket.ctx.logger.debug("redis connection added to context");
  });
