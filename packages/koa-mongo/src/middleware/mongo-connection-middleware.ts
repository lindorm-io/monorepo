import { DefaultLindormMongoKoaMiddleware } from "../types";
import { IMongoConnection } from "@lindorm-io/mongo";
import { ServerError } from "@lindorm-io/errors";

export const mongoConnectionMiddleware =
  (connection: IMongoConnection): DefaultLindormMongoKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("mongo");

    if (!connection.isConnected) {
      throw new ServerError("Server is not connected to mongo");
    }

    ctx.connection.mongo = connection;

    ctx.logger.debug("Mongo connection added to context");

    metric.end();

    await next();
  };
