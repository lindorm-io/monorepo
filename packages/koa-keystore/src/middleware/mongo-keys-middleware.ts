import { DefaultLindormKeystoreKoaMiddleware } from "../types";
import { getKeysFromMongo } from "../utils";

export const mongoKeysMiddleware: DefaultLindormKeystoreKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const metric = ctx.getMetric("keystore");

  const keys = await getKeysFromMongo(ctx);

  ctx.keys = [ctx.keys, keys].flat();

  metric.end();

  await next();
};
