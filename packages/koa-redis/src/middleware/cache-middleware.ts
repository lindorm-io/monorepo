import { CacheBase } from "@lindorm-io/redis";
import { DefaultLindormRedisKoaMiddleware } from "../types";
import { camelCase } from "lodash";

interface Options {
  cacheKey?: string;
  expiresInSeconds?: number;
}

export const cacheMiddleware =
  (Cache: typeof CacheBase, options?: Options): DefaultLindormRedisKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("redis");

    const cache = options?.cacheKey || camelCase(Cache.name);

    /*
     * Ignoring TS here since Cache needs to be abstract
     * to ensure that all input at least attempts to be unique
     */
    // @ts-ignore
    ctx.cache[cache] = new Cache({
      client: ctx.connection.redis.client(),
      expiresInSeconds: options?.expiresInSeconds,
      logger: ctx.logger,
    });

    metric.end();

    await next();
  };
