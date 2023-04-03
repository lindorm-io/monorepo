import { camelCase } from "@lindorm-io/case";
import { ServerError } from "@lindorm-io/errors";
import { IMongoConnection, MongoRepositoryConstructor } from "@lindorm-io/mongo";
import { DefaultLindormMiddleware } from "@lindorm-io/koa";

type Options = {
  repositoryKey?: string;
};

export const mongoRepositoryMiddleware =
  (
    connection: IMongoConnection,
    Repository: MongoRepositoryConstructor,
    options?: Options,
  ): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("mongo");

    const repository = options?.repositoryKey || camelCase(Repository.name);

    if (!repository) {
      throw new ServerError("Invalid repository name", {
        debug: { repository },
      });
    }

    ctx.mongo[repository] = new Repository(connection, ctx.logger);

    metric.end();

    await next();
  };
