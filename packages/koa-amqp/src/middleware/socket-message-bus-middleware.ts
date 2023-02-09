import { DefaultLindormAmqpSocketMiddleware } from "../types";
import { MessageBusBase } from "@lindorm-io/amqp";
import { getSocketError } from "@lindorm-io/koa";

export const socketMessageBusMiddleware =
  (MessageBus: typeof MessageBusBase): DefaultLindormAmqpSocketMiddleware =>
  (socket, next) => {
    try {
      /*
       * Ignoring TS here since MessageBus needs to be abstract
       * to ensure that all input at least attempts to be unique
       */
      // @ts-ignore
      socket.ctx.messageBus = new MessageBus({
        connection: socket.ctx.connection.amqp,
        logger: socket.ctx.logger,
      });

      next();
    } catch (err: any) {
      next(getSocketError(socket, err));
    }
  };
