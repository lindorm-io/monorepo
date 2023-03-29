import { DefaultLindormKeystoreKoaMiddleware, JwksKeysMiddlewareConfig } from "../types";
import { getKeysFromJwks } from "../util";

export const jwksKeysMiddleware =
  (config: JwksKeysMiddlewareConfig): DefaultLindormKeystoreKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("keystore");

    ctx.keys = await getKeysFromJwks(
      {
        host: config.host,
        port: config.port,
        alias: config.alias,
        client: config.client,
        currentKeys: ctx.keys,
        path: config.path,
      },
      ctx.logger,
    );

    metric.end();

    await next();
  };
