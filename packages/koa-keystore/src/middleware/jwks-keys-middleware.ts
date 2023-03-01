import { DefaultLindormKeystoreKoaMiddleware, JwksKeysMiddlewareConfig } from "../types";
import { getKeysFromJwks } from "../util";

export const jwksKeysMiddleware =
  (config: JwksKeysMiddlewareConfig): DefaultLindormKeystoreKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("keystore");

    ctx.keys = await getKeysFromJwks({
      clientName: config.clientName,
      currentKeys: ctx.keys,
      host: config.host,
      logger: ctx.logger,
      path: config.path,
      port: config.port,
    });

    metric.end();

    await next();
  };
