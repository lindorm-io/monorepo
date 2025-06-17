import { isObject } from "@lindorm/is";
import { IRabbitSource } from "../interfaces";
import { RabbitPylonHttpContext, RabbitPylonHttpMiddleware } from "../types";

export const createHttpRabbitSourceMiddleware = <
  C extends RabbitPylonHttpContext = RabbitPylonHttpContext,
>(
  source: IRabbitSource,
): RabbitPylonHttpMiddleware<C> => {
  return async function httpRabbitSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.rabbit = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Rabbit Source added to http context");

    await next();
  };
};
