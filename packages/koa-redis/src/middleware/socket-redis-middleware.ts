import { IRedisConnection } from "@lindorm-io/redis";
import { DefaultLindormRedisSocketMiddleware } from "../types";
import { getSocketError } from "@lindorm-io/koa";

export const socketRedisMiddleware =
  (connection: IRedisConnection): DefaultLindormRedisSocketMiddleware =>
  (socket, next) => {
    try {
      socket.ctx.connection.redis = connection;
      socket.ctx.logger.debug("redis connection added to context");
      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
