import { DefaultLindormKeystoreKoaMiddleware } from "../types";
import { getKeysFromMemory } from "../util";

export const memoryKeysMiddleware: DefaultLindormKeystoreKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const metric = ctx.getMetric("keystore");

  ctx.keys = await getKeysFromMemory(ctx);

  metric.end();

  await next();
};
