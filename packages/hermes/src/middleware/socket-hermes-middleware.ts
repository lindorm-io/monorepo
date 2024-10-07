import { IHermes } from "../interfaces";
import { HermesPylonEventContext, HermesPylonEventMiddleware } from "../types";

export const createSocketHermesMiddleware = <
  C extends HermesPylonEventContext = HermesPylonEventContext,
>(
  hermes: IHermes,
): HermesPylonEventMiddleware<C> => {
  return async function socketHermesMiddleware(ctx, next): Promise<void> {
    ctx.hermes = hermes.clone({ logger: ctx.logger });

    await next();
  };
};
