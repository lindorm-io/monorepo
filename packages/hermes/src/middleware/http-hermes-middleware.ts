import { IHermes } from "../interfaces";
import { HermesPylonHttpContext, HermesPylonHttpMiddleware } from "../types";

export const createHttpHermesMiddleware = <
  C extends HermesPylonHttpContext = HermesPylonHttpContext,
>(
  hermes: IHermes,
): HermesPylonHttpMiddleware<C> => {
  return async function httpHermesMiddleware(ctx, next): Promise<void> {
    ctx.hermes = hermes.clone({ logger: ctx.logger });

    await next();
  };
};
