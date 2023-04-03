import { camelCase } from "@lindorm-io/case";
import { ServerError } from "@lindorm-io/errors";
import { IRedisConnection, RedisRepositoryConstructor } from "@lindorm-io/redis";
import { DefaultLindormMiddleware } from "@lindorm-io/koa";

interface Options {
  repositoryKey?: string;
}

export const redisRepositoryMiddleware =
  (
    connection: IRedisConnection,
    Repository: RedisRepositoryConstructor,
    options?: Options,
  ): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("redis");

    const repository = options?.repositoryKey || camelCase(Repository.name);

    if (!repository) {
      throw new ServerError("Invalid repository name", {
        debug: { repository },
      });
    }

    ctx.redis[repository] = new Repository(connection, ctx.logger);

    metric.end();

    await next();
  };
