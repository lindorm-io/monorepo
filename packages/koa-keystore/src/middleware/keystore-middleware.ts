import { Middleware } from "@lindorm-io/koa";
import { KeystoreContext } from "../types";
import { Keystore } from "@lindorm-io/key-pair";

export const keystoreMiddleware: Middleware<KeystoreContext> = async (ctx, next): Promise<void> => {
  const metric = ctx.getMetric("keystore");

  ctx.keystore = new Keystore({ keys: ctx.keys });

  ctx.logger.debug("keystore initialised", { amount: ctx.keys.length });

  metric.end();

  await next();
};
