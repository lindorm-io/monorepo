import { DefaultLindormMiddleware } from "../../types";
import { camelCase } from "@lindorm-io/case";
import { isObject } from "@lindorm-io/core";

export const paramsMiddleware: DefaultLindormMiddleware = async (ctx, next): Promise<void> => {
  const params = isObject(ctx.params) ? camelCase<Record<string, string>>(ctx.params) : {};

  for (const [key, value] of Object.entries(params)) {
    params[key] = decodeURIComponent(value);
  }

  ctx.data = {
    ...ctx.data,
    ...params,
  };

  await next();
};
