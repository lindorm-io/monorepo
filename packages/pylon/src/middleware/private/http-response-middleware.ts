import { ChangeCase, changeKeys } from "@lindorm/case";
import { isArray, isObject } from "@lindorm/is";
import { PylonHttpMiddleware } from "../../types";

export const httpResponseMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  const startTime = Date.now();

  try {
    await next();
  } finally {
    if (isObject(ctx.body) || isArray(ctx.body)) {
      ctx.body = changeKeys(ctx.body, ChangeCase.Snake);
    }

    const endTime = Date.now();

    ctx.set("Date", new Date().toUTCString());
    ctx.set("X-Start-Time", startTime.toString());
    ctx.set("X-Current-Time", endTime.toString());
    ctx.set("X-Response-Time", `${endTime - startTime}ms`);
  }
};
