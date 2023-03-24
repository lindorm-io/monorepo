import { DefaultLindormKeystoreKoaMiddleware } from "../types";
import { getKeysFromMongo } from "../util";

export const mongoKeysMiddleware: DefaultLindormKeystoreKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const metric = ctx.getMetric("keystore");

  ctx.keys = await getKeysFromMongo(ctx);

  metric.end();

  await next();
};
