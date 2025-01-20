import { isObject } from "@lindorm/is";
import { IMongoSource } from "../interfaces";
import { MongoPylonHttpContext, MongoPylonHttpMiddleware } from "../types";

export const createHttpMongoSourceMiddleware = <
  C extends MongoPylonHttpContext = MongoPylonHttpContext,
>(
  source: IMongoSource,
): MongoPylonHttpMiddleware<C> => {
  return async function httpMongoSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.mongo = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Mongo Source added to http context");

    await next();
  };
};
