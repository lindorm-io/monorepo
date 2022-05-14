import { KeystoreContext } from "../types";
import { Middleware } from "@lindorm-io/koa";
import { WebKeyHandler } from "../class";
import { flatten } from "lodash";

interface Options {
  clientName: string;
  host: string;
  port?: number;
}

export const jwksKeysMiddleware =
  (options: Options): Middleware<KeystoreContext> =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("keystore");

    const handler = new WebKeyHandler({
      clientName: options.clientName,
      host: options.host,
      port: options.port,
      logger: ctx.logger,
    });

    const keys = await handler.getKeys();

    ctx.keys = flatten([ctx.keys, keys]);

    ctx.logger.debug("keys found on client", {
      clientName: options.clientName,
      host: options.host,
      port: options.port,
      amount: keys.length,
      total: ctx.keys.length,
    });

    metric.end();

    await next();
  };
