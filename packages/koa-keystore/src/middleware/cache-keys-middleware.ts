import { Middleware } from "@lindorm-io/koa";
import { flatten } from "lodash";
import { KeystoreContext } from "../types";

export const cacheKeysMiddleware: Middleware<KeystoreContext> = async (
  ctx,
  next,
): Promise<void> => {
  const metric = ctx.getMetric("keystore");

  const keys = await ctx.cache.keyPairCache.findMany({});

  ctx.keys = flatten([ctx.keys, keys]);

  ctx.logger.debug("keys found in cache", {
    amount: keys.length,
    total: ctx.keys.length,
  });

  metric.end();

  await next();
};
