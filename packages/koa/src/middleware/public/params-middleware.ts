import { DefaultLindormMiddleware } from "../../types";
import { camelKeys, isObjectStrict } from "@lindorm-io/core";

export const paramsMiddleware: DefaultLindormMiddleware = async (ctx, next): Promise<void> => {
  const params = isObjectStrict(ctx.params) ? camelKeys(ctx.params) : {};

  for (const [key, value] of Object.entries(params)) {
    params[key] = decodeURIComponent(value);
  }

  ctx.data = {
    ...ctx.data,
    ...params,
  };

  await next();
};
