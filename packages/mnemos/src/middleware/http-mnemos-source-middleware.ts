import { IMnemosSource } from "../interfaces";
import { MnemosPylonHttpContext, MnemosPylonHttpMiddleware } from "../types";

export const createHttpMnemosSourceMiddleware = <
  C extends MnemosPylonHttpContext = MnemosPylonHttpContext,
>(
  source: IMnemosSource,
): MnemosPylonHttpMiddleware<C> => {
  return async function httpMnemosSourceMiddleware(ctx, next): Promise<void> {
    ctx.mnemos = source.clone({ logger: ctx.logger });

    await next();
  };
};
