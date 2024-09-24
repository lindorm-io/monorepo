import { IRedisSource } from "../interfaces";
import { RedisPylonEventContext, RedisPylonEventMiddleware } from "../types";

export const createSocketRedisSourceMiddleware = <
  C extends RedisPylonEventContext = RedisPylonEventContext,
>(
  source: IRedisSource,
): RedisPylonEventMiddleware<C> => {
  return async function socketRedisSourceMiddleware(ctx, next): Promise<void> {
    ctx.redis = source.clone(ctx.logger);

    await next();
  };
};
