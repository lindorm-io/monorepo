import { DefaultLindormKeystoreKoaMiddleware } from "../types";
import { getKeysFromRedis } from "../util";

export const redisKeysMiddleware: DefaultLindormKeystoreKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const metric = ctx.getMetric("keystore");

  ctx.keys = await getKeysFromRedis(ctx);

  metric.end();

  await next();
};
