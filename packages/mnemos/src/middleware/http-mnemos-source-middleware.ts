import { isObject } from "@lindorm/is";
import { IMnemosSource } from "../interfaces";
import { MnemosPylonHttpContext, MnemosPylonHttpMiddleware } from "../types";

export const createHttpMnemosSourceMiddleware = <
  C extends MnemosPylonHttpContext = MnemosPylonHttpContext,
>(
  source: IMnemosSource,
): MnemosPylonHttpMiddleware<C> => {
  return async function httpMnemosSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.mnemos = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Mnemos Source added to http context");

    await next();
  };
};
