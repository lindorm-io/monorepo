import { IMongoSource } from "../interfaces";
import { MongoPylonHttpContext, MongoPylonHttpMiddleware } from "../types";

export const createHttpMongoSourceMiddleware = <
  C extends MongoPylonHttpContext = MongoPylonHttpContext,
>(
  source: IMongoSource,
): MongoPylonHttpMiddleware<C> => {
  return async function httpMongoSourceMiddleware(ctx, next): Promise<void> {
    ctx.mongo = source.clone({ logger: ctx.logger });

    await next();
  };
};
