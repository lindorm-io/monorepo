import { isObject } from "@lindorm/is";
import { IElasticSource } from "../interfaces";
import { ElasticPylonEventContext, ElasticPylonEventMiddleware } from "../types";

export const createSocketElasticSourceMiddleware = <
  C extends ElasticPylonEventContext = ElasticPylonEventContext,
>(
  source: IElasticSource,
): ElasticPylonEventMiddleware<C> => {
  return async function socketElasticSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.elastic = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Elastic Source added to event context");

    await next();
  };
};
