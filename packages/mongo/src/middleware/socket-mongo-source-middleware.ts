import { isObject } from "@lindorm/is";
import { IMongoSource } from "../interfaces";
import { MongoPylonEventContext, MongoPylonEventMiddleware } from "../types";

export const createSocketMongoSourceMiddleware = <
  C extends MongoPylonEventContext = MongoPylonEventContext,
>(
  source: IMongoSource,
): MongoPylonEventMiddleware<C> => {
  return async function socketMongoSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.mongo = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Mongo Source added to socket context");

    await next();
  };
};
