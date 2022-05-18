import { CacheBase } from "@lindorm-io/redis";
import { DefaultLindormRedisSocketMiddleware } from "../types";
import { camelCase } from "lodash";
import { getSocketError } from "@lindorm-io/koa";

interface Options {
  cacheKey?: string;
  expiresInSeconds?: number;
}

export const socketCacheMiddleware =
  (Cache: typeof CacheBase, options?: Options): DefaultLindormRedisSocketMiddleware =>
  (socket, next) => {
    try {
      const cache = options?.cacheKey || camelCase(Cache.name);

      /*
       * Ignoring TS here since Cache needs to be abstract
       * to ensure that all input at least attempts to be unique
       */
      // @ts-ignore
      socket.ctx.cache[cache] = new Cache({
        connection: socket.ctx.connection.redis,
        expiresInSeconds: options?.expiresInSeconds,
        logger: socket.ctx.logger,
      });

      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
