import { ChangeCase, changeKeys } from "@lindorm/case";
import { isObject } from "@lindorm/is";
import { ConduitMiddleware } from "../../types";

export const conduitChangeRequestQueryMiddleware =
  (mode: ChangeCase = ChangeCase.Snake): ConduitMiddleware =>
  async (ctx, next) => {
    const { query } = ctx.req;

    if (query && isObject(query)) {
      ctx.req.query = changeKeys(query, mode);
    }

    await next();
  };
