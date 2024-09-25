import { IMongoSource } from "../interfaces";
import { MongoPylonEventContext, MongoPylonEventMiddleware } from "../types";

export const createSocketMongoSourceMiddleware = <
  C extends MongoPylonEventContext = MongoPylonEventContext,
>(
  source: IMongoSource,
): MongoPylonEventMiddleware<C> => {
  return async function socketMongoSourceMiddleware(ctx, next): Promise<void> {
    ctx.mongo = source.clone({ logger: ctx.logger });

    await next();
  };
};
