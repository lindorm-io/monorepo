import { KeystoreContext } from "../types";
import { Middleware } from "@lindorm-io/koa";
import { WebKeyHandler } from "../class";
import { flatten } from "lodash";

interface Options {
  baseUrl: string;
  clientName: string;
}

export const jwksKeysMiddleware =
  (options: Options): Middleware<KeystoreContext> =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("keystore");

    const handler = new WebKeyHandler({
      baseUrl: options.baseUrl,
      logger: ctx.logger,
      clientName: options.clientName,
    });

    const keys = await handler.getKeys();

    ctx.keys = flatten([ctx.keys, keys]);

    ctx.logger.debug("keys found on client", {
      baseUrl: options.baseUrl,
      client: options.clientName,
      amount: keys.length,
      total: ctx.keys.length,
    });

    metric.end();

    await next();
  };
