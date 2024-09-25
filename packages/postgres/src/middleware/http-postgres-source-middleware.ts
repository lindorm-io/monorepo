import { IPostgresSource } from "../interfaces";
import { PostgresPylonHttpContext, PostgresPylonHttpMiddleware } from "../types";

export const createHttpPostgresSourceMiddleware = <
  C extends PostgresPylonHttpContext = PostgresPylonHttpContext,
>(
  source: IPostgresSource,
): PostgresPylonHttpMiddleware<C> => {
  return async function httpPostgresSourceMiddleware(ctx, next): Promise<void> {
    ctx.postgres = source.clone({ logger: ctx.logger });

    await next();
  };
};
