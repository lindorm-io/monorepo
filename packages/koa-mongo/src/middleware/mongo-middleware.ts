import { Middleware } from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { MongoContext } from "../types";

export const mongoMiddleware =
  (connection: MongoConnection): Middleware<MongoContext> =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("mongo");

    await connection.waitForConnection();

    ctx.connection.mongo = connection;

    ctx.logger.debug("mongo connection added to context");

    metric.end();

    await next();
  };
