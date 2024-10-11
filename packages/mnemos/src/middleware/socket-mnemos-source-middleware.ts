import { IMnemosSource } from "../interfaces";
import { MnemosPylonEventContext, MnemosPylonEventMiddleware } from "../types";

export const createSocketMnemosSourceMiddleware = <
  C extends MnemosPylonEventContext = MnemosPylonEventContext,
>(
  source: IMnemosSource,
): MnemosPylonEventMiddleware<C> => {
  return async function socketMnemosSourceMiddleware(ctx, next): Promise<void> {
    ctx.mnemos = source.clone({ logger: ctx.logger });

    await next();
  };
};
