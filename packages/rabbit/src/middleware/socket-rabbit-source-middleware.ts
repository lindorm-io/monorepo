import { IRabbitSource } from "../interfaces";
import { RabbitPylonEventContext, RabbitPylonEventMiddleware } from "../types";

export const createSocketRabbitSourceMiddleware = <
  C extends RabbitPylonEventContext = RabbitPylonEventContext,
>(
  source: IRabbitSource,
): RabbitPylonEventMiddleware<C> => {
  return async function socketRabbitSourceMiddleware(ctx, next): Promise<void> {
    ctx.rabbit = source.clone(ctx.logger);

    await next();
  };
};
