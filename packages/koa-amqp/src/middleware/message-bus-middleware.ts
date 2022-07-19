import { MessageBusBase } from "@lindorm-io/amqp";
import { DefaultLindormAmqpKoaMiddleware } from "../types";

export const messageBusMiddleware =
  (MessageBus: typeof MessageBusBase): DefaultLindormAmqpKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("amqp");

    /*
     * Ignoring TS here since MessageBus needs to be abstract
     * to ensure that all input at least attempts to be unique
     */
    // @ts-ignore
    ctx.messageBus = new MessageBus({
      connection: ctx.connection.amqp,
      logger: ctx.logger,
    });

    metric.end();

    await next();
  };
