import { DefaultLindormKeystoreKoaMiddleware } from "../types";
import { getKeysFromCache } from "../util";

export const cacheKeysMiddleware: DefaultLindormKeystoreKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const metric = ctx.getMetric("keystore");

  ctx.keys = await getKeysFromCache(ctx);

  metric.end();

  await next();
};
