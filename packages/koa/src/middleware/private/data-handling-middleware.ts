import { KoaContext, Middleware } from "../../types";
import { camelKeys, isObjectStrict, snakeKeys } from "@lindorm-io/core";

export const dataHandlingMiddleware: Middleware<KoaContext> = async (ctx, next): Promise<void> => {
  const body = isObjectStrict(ctx.request.body) ? camelKeys(ctx.request.body) : {};
  const query = isObjectStrict(ctx.query) ? camelKeys(ctx.query) : {};

  for (const [key, value] of Object.entries(query)) {
    query[key] = decodeURIComponent(value);
  }

  ctx.data = {
    ...body,
    ...query,
  };

  await next();

  ctx.body = isObjectStrict(ctx.body) ? snakeKeys(ctx.body) : ctx.body;
};
