import { ChangeCase, changeKeys } from "@lindorm/case";
import { isObject } from "@lindorm/is";
import { ConduitMiddleware } from "../types";

export const conduitChangeRequestQueryMiddleware = (
  mode: ChangeCase = "snake",
): ConduitMiddleware =>
  async function conduitChangeRequestQueryMiddleware(ctx, next) {
    const { query } = ctx.req;

    if (query && isObject(query)) {
      ctx.req.query = changeKeys(query, mode);
    }

    await next();
  };
