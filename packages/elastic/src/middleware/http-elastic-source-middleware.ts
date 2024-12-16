import { IElasticSource } from "../interfaces";
import { ElasticPylonHttpContext, ElasticPylonHttpMiddleware } from "../types";

export const createHttpElasticSourceMiddleware = <
  C extends ElasticPylonHttpContext = ElasticPylonHttpContext,
>(
  source: IElasticSource,
): ElasticPylonHttpMiddleware<C> => {
  return async function httpElasticSourceMiddleware(ctx, next): Promise<void> {
    ctx.elastic = source.clone({ logger: ctx.logger });

    await next();
  };
};
