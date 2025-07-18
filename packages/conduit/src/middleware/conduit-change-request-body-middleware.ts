import { ChangeCase, changeKeys } from "@lindorm/case";
import { isArray, isObject } from "@lindorm/is";
import { ConduitMiddleware } from "../types";

export const conduitChangeRequestBodyMiddleware = (
  mode: ChangeCase = "snake",
): ConduitMiddleware =>
  async function conduitChangeRequestBodyMiddleware(ctx, next) {
    const { body } = ctx.req;

    if (isObject(body) || isArray(body)) {
      ctx.req.body = changeKeys(body, mode);
    }

    await next();
  };
