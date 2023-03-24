import { camelCase } from "@lindorm-io/case";
import { DefaultLindormSocketMiddleware, getSocketError } from "@lindorm-io/koa";
import { ServerError } from "@lindorm-io/errors";
import { IMemoryDatabase, MemoryCacheConstructor } from "@lindorm-io/in-memory-cache";

type Options = {
  cacheKey?: string;
};

export const socketMemoryCacheMiddleware =
  (
    database: IMemoryDatabase,
    MemoryCache: MemoryCacheConstructor,
    options?: Options,
  ): DefaultLindormSocketMiddleware =>
  (socket, next) => {
    try {
      const cache = options?.cacheKey || camelCase(MemoryCache.name);

      if (!cache) {
        throw new ServerError("Invalid cache name", {
          debug: { cache },
        });
      }

      socket.ctx.memory[cache] = new MemoryCache(database, socket.ctx.logger);

      next();
    } catch (err: any) {
      next(getSocketError(socket, err));
    }
  };
