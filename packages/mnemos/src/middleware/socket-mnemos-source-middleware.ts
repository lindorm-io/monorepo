import { isObject } from "@lindorm/is";
import { IMnemosSource } from "../interfaces";
import { MnemosPylonEventContext, MnemosPylonEventMiddleware } from "../types";

export const createSocketMnemosSourceMiddleware = <
  C extends MnemosPylonEventContext = MnemosPylonEventContext,
>(
  source: IMnemosSource,
): MnemosPylonEventMiddleware<C> => {
  return async function socketMnemosSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.mnemos = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Mnemos Source added to event context");

    await next();
  };
};
