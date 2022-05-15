import { DefaultLindormKeystoreKoaMiddleware, JwksKeysMiddlewareConfig } from "../types";
import { getKeysFromJwks } from "../util";

export const jwksKeysMiddleware =
  (config: JwksKeysMiddlewareConfig): DefaultLindormKeystoreKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("keystore");

    ctx.keys = await getKeysFromJwks(ctx, config);

    metric.end();

    await next();
  };
