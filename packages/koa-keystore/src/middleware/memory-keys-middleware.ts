import { DefaultLindormKeystoreKoaMiddleware } from "../types";
import { getKeysFromMemory } from "../utils";

export const memoryKeysMiddleware: DefaultLindormKeystoreKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const metric = ctx.getMetric("keystore");

  const keys = await getKeysFromMemory(ctx);

  ctx.keys = [ctx.keys, keys].flat();

  metric.end();

  await next();
};
