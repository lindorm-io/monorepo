import { isObject } from "@lindorm/is";
import { IMongoSource } from "../interfaces";
import { MongoPylonSocketContext, MongoPylonSocketMiddleware } from "../types";

export const createSocketMongoSourceMiddleware = <
  C extends MongoPylonSocketContext = MongoPylonSocketContext,
>(
  source: IMongoSource,
): MongoPylonSocketMiddleware<C> => {
  return async function socketMongoSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.mongo = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Mongo Source added to socket context");

    await next();
  };
};
