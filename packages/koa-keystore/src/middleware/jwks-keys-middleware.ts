import { DefaultLindormKeystoreKoaMiddleware, JwksKeysMiddlewareConfig } from "../types";
import { getKeysFromJwks } from "../utils";

export const jwksKeysMiddleware =
  (config: JwksKeysMiddlewareConfig): DefaultLindormKeystoreKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("keystore");

    const keys = await getKeysFromJwks(
      {
        host: config.host,
        port: config.port,
        alias: config.alias,
        path: config.path,
      },
      ctx.logger,
    );

    ctx.keys = [ctx.keys, keys].flat();

    metric.end();

    await next();
  };
