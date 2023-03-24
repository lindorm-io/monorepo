import { DefaultLindormMongoKoaMiddleware } from "../types";
import { camelCase } from "@lindorm-io/case";
import { ServerError } from "@lindorm-io/errors";
import { MongoRepositoryConstructor } from "@lindorm-io/mongo";

type Options = {
  repositoryKey?: string;
};

export const mongoRepositoryMiddleware =
  (
    MongoRepository: MongoRepositoryConstructor,
    options?: Options,
  ): DefaultLindormMongoKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("mongo");

    const repository = options?.repositoryKey || camelCase(MongoRepository.name);

    if (!repository) {
      throw new ServerError("Invalid repository name", {
        debug: { repository },
      });
    }

    ctx.mongo[repository] = new MongoRepository(ctx.connection.mongo, ctx.logger);

    metric.end();

    await next();
  };
