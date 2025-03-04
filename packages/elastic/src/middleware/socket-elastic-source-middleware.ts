import { isObject } from "@lindorm/is";
import { IElasticSource } from "../interfaces";
import { ElasticPylonSocketContext, ElasticPylonSocketMiddleware } from "../types";

export const createSocketElasticSourceMiddleware = <
  C extends ElasticPylonSocketContext = ElasticPylonSocketContext,
>(
  source: IElasticSource,
): ElasticPylonSocketMiddleware<C> => {
  return async function socketElasticSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.elastic = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Elastic Source added to event context");

    await next();
  };
};
