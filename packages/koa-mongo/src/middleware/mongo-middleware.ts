import { DefaultLindormMongoKoaMiddleware } from "../types";
import { MongoConnection } from "@lindorm-io/mongo";

export const mongoMiddleware =
  (connection: MongoConnection): DefaultLindormMongoKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("mongo");

    await connection.waitForConnection();

    ctx.connection.mongo = connection;

    ctx.logger.debug("mongo connection added to context");

    metric.end();

    await next();
  };
