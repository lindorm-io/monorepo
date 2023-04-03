import { DefaultLindormAmqpSocketMiddleware } from "../types";
import { IAmqpConnection, MessageBusConstructor } from "@lindorm-io/amqp";
import { getSocketError } from "@lindorm-io/koa";

export const socketMessageBusMiddleware =
  (
    connection: IAmqpConnection,
    MessageBus: MessageBusConstructor,
  ): DefaultLindormAmqpSocketMiddleware =>
  (socket, next) => {
    try {
      socket.ctx.messageBus = new MessageBus(connection, socket.ctx.logger);

      next();
    } catch (err: any) {
      next(getSocketError(socket, err));
    }
  };
