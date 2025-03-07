import { ChangeCase, changeKeys } from "@lindorm/case";
import { isArray, isObject } from "@lindorm/is";
import { Stream } from "stream";
import { PylonHttpMiddleware } from "../../types";

export const httpResponseBodyMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  try {
    await next();
  } finally {
    try {
      if ((isObject(ctx.body) && !(ctx.body instanceof Stream)) || isArray(ctx.body)) {
        ctx.body = changeKeys(ctx.body, ChangeCase.Snake);
      }
    } catch (err: any) {
      ctx.logger?.error(err);
    }
  }
};
