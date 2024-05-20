import { ChangeCase, changeKeys } from "@lindorm/case";
import { ConduitMiddleware } from "../types";

export const conduitChangeRequestHeadersMiddleware =
  (mode: ChangeCase = ChangeCase.Header): ConduitMiddleware =>
  async (ctx, next) => {
    const { headers } = ctx.req;

    if (Object.keys(headers).length) {
      ctx.req.headers = changeKeys(headers, mode);
    }

    await next();
  };
