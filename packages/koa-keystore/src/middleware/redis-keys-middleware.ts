import { DefaultLindormKeystoreKoaMiddleware } from "../types";
import { getKeysFromRedis } from "../utils";

export const redisKeysMiddleware: DefaultLindormKeystoreKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const metric = ctx.getMetric("keystore");

  const keys = await getKeysFromRedis(ctx);

  ctx.keys = [ctx.keys, keys].flat();

  metric.end();

  await next();
};
