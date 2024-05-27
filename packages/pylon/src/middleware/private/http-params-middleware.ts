import { ChangeCase, changeKeys } from "@lindorm/case";
import { isObject } from "@lindorm/is";
import { PylonHttpMiddleware } from "../../types";

export const httpParamsMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  const params = isObject(ctx.params) ? changeKeys(ctx.params, ChangeCase.Camel) : {};

  for (const [key, value] of Object.entries(params)) {
    params[key] = decodeURIComponent(value);
  }

  ctx.data = { ...ctx.data, ...params };

  await next();
};
