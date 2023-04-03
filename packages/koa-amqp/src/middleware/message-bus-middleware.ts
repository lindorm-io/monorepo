import { IAmqpConnection, MessageBusConstructor } from "@lindorm-io/amqp";
import { DefaultLindormAmqpKoaMiddleware } from "../types";

export const messageBusMiddleware =
  (
    connection: IAmqpConnection,
    MessageBus: MessageBusConstructor,
  ): DefaultLindormAmqpKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("amqp");

    ctx.messageBus = new MessageBus(connection, ctx.logger);

    metric.end();

    await next();
  };
