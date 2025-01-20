import { isObject } from "@lindorm/is";
import { IRedisSource } from "../interfaces";
import { RedisPylonEventContext, RedisPylonEventMiddleware } from "../types";

export const createSocketRedisSourceMiddleware = <
  C extends RedisPylonEventContext = RedisPylonEventContext,
>(
  source: IRedisSource,
): RedisPylonEventMiddleware<C> => {
  return async function socketRedisSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.redis = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Redis Source added to event context");

    await next();
  };
};
