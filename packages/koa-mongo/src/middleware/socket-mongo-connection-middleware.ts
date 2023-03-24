import { IMongoConnection } from "@lindorm-io/mongo";
import { DefaultLindormMongoSocketMiddleware } from "../types";
import { getSocketError } from "@lindorm-io/koa";

export const socketMongoConnectionMiddleware =
  (connection: IMongoConnection): DefaultLindormMongoSocketMiddleware =>
  (socket, next) => {
    try {
      socket.ctx.connection.mongo = connection;
      socket.ctx.logger.debug("mongo connection added to context");
      next();
    } catch (err: any) {
      next(getSocketError(socket, err));
    }
  };
