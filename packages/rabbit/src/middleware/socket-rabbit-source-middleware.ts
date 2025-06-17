import { isObject } from "@lindorm/is";
import { IRabbitSource } from "../interfaces";
import { RabbitPylonSocketContext, RabbitPylonSocketMiddleware } from "../types";

export const createSocketRabbitSourceMiddleware = <
  C extends RabbitPylonSocketContext = RabbitPylonSocketContext,
>(
  source: IRabbitSource,
): RabbitPylonSocketMiddleware<C> => {
  return async function socketRabbitSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.rabbit = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Rabbit Source added to event context");

    await next();
  };
};
