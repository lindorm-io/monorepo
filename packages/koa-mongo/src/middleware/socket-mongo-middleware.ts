import { IMongoConnection } from "@lindorm-io/mongo";
import { DefaultLindormMongoSocketMiddleware } from "../types";
import { getSocketError } from "@lindorm-io/koa";

export const socketMongoMiddleware =
  (connection: IMongoConnection): DefaultLindormMongoSocketMiddleware =>
  (socket, next) => {
    try {
      socket.ctx.connection.mongo = connection;
      socket.ctx.logger.debug("mongo connection added to context");
      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
