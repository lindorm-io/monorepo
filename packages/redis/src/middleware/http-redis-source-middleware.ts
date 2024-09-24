import { IRedisSource } from "../interfaces";
import { RedisPylonHttpContext, RedisPylonHttpMiddleware } from "../types";

export const createHttpRedisSourceMiddleware = <
  C extends RedisPylonHttpContext = RedisPylonHttpContext,
>(
  source: IRedisSource,
): RedisPylonHttpMiddleware<C> => {
  return async function httpRedisSourceMiddleware(ctx, next): Promise<void> {
    ctx.redis = source.clone(ctx.logger);

    await next();
  };
};
