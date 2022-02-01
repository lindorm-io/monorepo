import { Middleware } from "@lindorm-io/koa";
import { KeystoreContext } from "../types";
import { flatten } from "lodash";

export const repositoryKeysMiddleware: Middleware<KeystoreContext> = async (
  ctx,
  next,
): Promise<void> => {
  const metric = ctx.getMetric("keystore");

  const keys = await ctx.repository.keyPairRepository.findMany({});

  ctx.keys = flatten([ctx.keys, keys]);

  ctx.logger.debug("keys found in repository", {
    amount: keys.length,
    total: ctx.keys.length,
  });

  metric.end();

  await next();
};
