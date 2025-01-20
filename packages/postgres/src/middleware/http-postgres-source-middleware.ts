import { isObject } from "@lindorm/is";
import { IPostgresSource } from "../interfaces";
import { PostgresPylonHttpContext, PostgresPylonHttpMiddleware } from "../types";

export const createHttpPostgresSourceMiddleware = <
  C extends PostgresPylonHttpContext = PostgresPylonHttpContext,
>(
  source: IPostgresSource,
): PostgresPylonHttpMiddleware<C> => {
  return async function httpPostgresSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.postgres = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Postgres Source added to http context");

    await next();
  };
};
