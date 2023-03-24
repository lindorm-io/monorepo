import { DefaultLindormRedisKoaMiddleware } from "../types";
import { camelCase } from "@lindorm-io/case";
import { ServerError } from "@lindorm-io/errors";
import { RedisRepositoryConstructor } from "@lindorm-io/redis";

interface Options {
  repositoryKey?: string;
}

export const redisRepositoryMiddleware =
  (Repository: RedisRepositoryConstructor, options?: Options): DefaultLindormRedisKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("redis");

    const repository = options?.repositoryKey || camelCase(Repository.name);

    if (!repository) {
      throw new ServerError("Invalid repository name", {
        debug: { repository },
      });
    }

    ctx.redis[repository] = new Repository(ctx.connection.redis, ctx.logger);

    metric.end();

    await next();
  };
