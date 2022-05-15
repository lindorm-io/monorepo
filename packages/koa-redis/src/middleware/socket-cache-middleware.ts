import { CacheBase } from "@lindorm-io/redis";
import { DefaultLindormRedisSocketMiddleware } from "../types";
import { camelCase } from "lodash";

interface Options {
  cacheKey?: string;
  expiresInSeconds?: number;
}

export const socketCacheMiddleware =
  (Cache: typeof CacheBase, options?: Options): DefaultLindormRedisSocketMiddleware =>
  (socket, next) => {
    const cache = options?.cacheKey || camelCase(Cache.name);

    /*
     * Ignoring TS here since Cache needs to be abstract
     * to ensure that all input at least attempts to be unique
     */
    // @ts-ignore
    ctx.cache[cache] = new Cache({
      client: socket.ctx.connection.redis.client(),
      expiresInSeconds: options?.expiresInSeconds,
      logger: socket.ctx.logger,
    });

    next();
  };
