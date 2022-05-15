import { DefaultLindormKeystoreKoaMiddleware } from "../types";
import { getKeysFromRepository } from "../util";

export const repositoryKeysMiddleware: DefaultLindormKeystoreKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const metric = ctx.getMetric("keystore");

  ctx.keys = await getKeysFromRepository(ctx);

  metric.end();

  await next();
};
