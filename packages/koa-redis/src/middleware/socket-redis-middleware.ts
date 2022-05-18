import { RedisConnection } from "@lindorm-io/redis";
import { DefaultLindormRedisSocketMiddleware } from "../types";
import { getSocketError } from "@lindorm-io/koa";

export const socketRedisMiddleware =
  (connection: RedisConnection): DefaultLindormRedisSocketMiddleware =>
  (socket, next) => {
    try {
      socket.ctx.connection.redis = connection;
      socket.ctx.logger.debug("redis connection added to context");
      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
