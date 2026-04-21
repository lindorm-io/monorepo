import { type ChangeCase, changeKeys } from "@lindorm/case";
import { isArray, isObject } from "@lindorm/is";
import type { ConduitMiddleware } from "../types/index.js";

export const conduitChangeResponseDataMiddleware = (
  mode: ChangeCase = "camel",
): ConduitMiddleware =>
  async function conduitChangeResponseDataMiddleware(ctx, next) {
    await next();

    const { data } = ctx.res;

    if (isObject(data) || isArray(data)) {
      ctx.res.data = changeKeys(data, mode);
    }
  };
