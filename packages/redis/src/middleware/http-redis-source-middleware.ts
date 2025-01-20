import { isObject } from "@lindorm/is";
import { IRedisSource } from "../interfaces";
import { RedisPylonHttpContext, RedisPylonHttpMiddleware } from "../types";

export const createHttpRedisSourceMiddleware = <
  C extends RedisPylonHttpContext = RedisPylonHttpContext,
>(
  source: IRedisSource,
): RedisPylonHttpMiddleware<C> => {
  return async function httpRedisSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.redis = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Redis Source added to http context");

    await next();
  };
};
