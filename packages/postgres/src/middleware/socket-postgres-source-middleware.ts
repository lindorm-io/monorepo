import { isObject } from "@lindorm/is";
import { IPostgresSource } from "../interfaces";
import { PostgresPylonSocketContext, PostgresPylonSocketMiddleware } from "../types";

export const createSocketPostgresSourceMiddleware = <
  C extends PostgresPylonSocketContext = PostgresPylonSocketContext,
>(
  source: IPostgresSource,
): PostgresPylonSocketMiddleware<C> => {
  return async function socketPostgresSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.postgres = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Postgres Source added to socket context");

    await next();
  };
};
