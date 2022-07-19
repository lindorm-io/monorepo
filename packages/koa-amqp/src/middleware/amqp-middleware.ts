import { DefaultLindormAmqpKoaMiddleware } from "../types";
import { AmqpConnection } from "@lindorm-io/amqp";

export const amqpMiddleware =
  (connection: AmqpConnection): DefaultLindormAmqpKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("amqp");

    await connection.connect();

    ctx.connection.amqp = connection;

    ctx.logger.debug("amqp connection added to context");

    metric.end();

    await next();
  };
