import { IRabbitSource } from "../interfaces";
import { RabbitPylonHttpContext, RabbitPylonHttpMiddleware } from "../types";

export const createHttpRabbitSourceMiddleware = <
  C extends RabbitPylonHttpContext = RabbitPylonHttpContext,
>(
  source: IRabbitSource,
): RabbitPylonHttpMiddleware<C> => {
  return async function httpRabbitSourceMiddleware(ctx, next): Promise<void> {
    ctx.rabbit = source.clone({ logger: ctx.logger });

    await next();
  };
};
