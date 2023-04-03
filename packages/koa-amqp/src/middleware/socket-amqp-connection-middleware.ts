import { IAmqpConnection } from "@lindorm-io/amqp";
import { DefaultLindormAmqpSocketMiddleware } from "../types";
import { getSocketError } from "@lindorm-io/koa";

export const socketAmqpConnectionMiddleware =
  (connection: IAmqpConnection): DefaultLindormAmqpSocketMiddleware =>
  (socket, next) => {
    try {
      socket.ctx.connection.amqp = connection;
      socket.ctx.logger.debug("amqp connection added to context");
      next();
    } catch (err: any) {
      next(getSocketError(socket, err));
    }
  };
