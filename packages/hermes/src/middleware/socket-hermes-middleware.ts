import { IHermes } from "../interfaces";
import { HermesPylonSocketContext, HermesPylonSocketMiddleware } from "../types";

export const createSocketHermesMiddleware = <
  C extends HermesPylonSocketContext = HermesPylonSocketContext,
>(
  hermes: IHermes,
): HermesPylonSocketMiddleware<C> => {
  return async function socketHermesMiddleware(ctx, next): Promise<void> {
    ctx.hermes = hermes.clone({ logger: ctx.logger });

    await next();
  };
};
