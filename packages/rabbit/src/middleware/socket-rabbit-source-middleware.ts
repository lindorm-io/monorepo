import { IRabbitSource } from "../interfaces";
import { RabbitPylonSocketContext, RabbitPylonSocketMiddleware } from "../types";

export const createSocketRabbitSourceMiddleware = <
  C extends RabbitPylonSocketContext = RabbitPylonSocketContext,
>(
  source: IRabbitSource,
): RabbitPylonSocketMiddleware<C> => {
  return async function socketRabbitSourceMiddleware(ctx, next): Promise<void> {
    ctx.rabbit = source.clone({ logger: ctx.logger });

    await next();
  };
};
