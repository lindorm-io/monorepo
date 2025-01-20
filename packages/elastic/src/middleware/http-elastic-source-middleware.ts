import { isObject } from "@lindorm/is";
import { IElasticSource } from "../interfaces";
import { ElasticPylonHttpContext, ElasticPylonHttpMiddleware } from "../types";

export const createHttpElasticSourceMiddleware = <
  C extends ElasticPylonHttpContext = ElasticPylonHttpContext,
>(
  source: IElasticSource,
): ElasticPylonHttpMiddleware<C> => {
  return async function httpElasticSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.elastic = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Elastic Source added to http context");

    await next();
  };
};
