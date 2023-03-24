import { DefaultLindormMiddleware } from "@lindorm-io/koa";
import { camelCase } from "@lindorm-io/case";
import { ServerError } from "@lindorm-io/errors";
import { IMemoryDatabase, MemoryCacheConstructor } from "@lindorm-io/in-memory-cache";

type Options = {
  cacheKey?: string;
};

export const memoryCacheMiddleware =
  (
    database: IMemoryDatabase,
    MemoryCache: MemoryCacheConstructor,
    options?: Options,
  ): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("memory");

    const cache = options?.cacheKey || camelCase(MemoryCache.name);

    if (!cache) {
      throw new ServerError("Invalid cache name", {
        debug: { cache },
      });
    }

    ctx.memory[cache] = new MemoryCache(database, ctx.logger);

    metric.end();

    await next();
  };
