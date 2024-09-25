import { IPostgresSource } from "../interfaces";
import { PostgresPylonEventContext, PostgresPylonEventMiddleware } from "../types";

export const createSocketPostgresSourceMiddleware = <
  C extends PostgresPylonEventContext = PostgresPylonEventContext,
>(
  source: IPostgresSource,
): PostgresPylonEventMiddleware<C> => {
  return async function socketPostgresSourceMiddleware(ctx, next): Promise<void> {
    ctx.postgres = source.clone({ logger: ctx.logger });

    await next();
  };
};
