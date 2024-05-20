import { ChangeCase, changeKeys } from "@lindorm/case";
import { isArray, isObject } from "@lindorm/is";
import { ConduitMiddleware } from "../types";

export const conduitChangeResponseDataMiddleware =
  (mode: ChangeCase = ChangeCase.Camel): ConduitMiddleware =>
  async (ctx, next) => {
    await next();

    const { data } = ctx.res;

    if (isObject(data) || isArray(data)) {
      ctx.res.data = changeKeys(data, mode);
    }
  };
