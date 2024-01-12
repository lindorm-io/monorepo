import { Keystore } from "@lindorm-io/keystore";
import { DefaultLindormKeystoreKoaMiddleware } from "../types";

export const keystoreMiddleware: DefaultLindormKeystoreKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const metric = ctx.getMetric("keystore");

  ctx.keystore = new Keystore(ctx.keys, ctx.logger);

  ctx.logger.debug("Keystore initialised", { amount: ctx.keystore.allKeys.length });

  metric.end();

  await next();
};
