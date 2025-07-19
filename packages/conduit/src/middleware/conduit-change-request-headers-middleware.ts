import { ChangeCase, changeKeys } from "@lindorm/case";
import { ConduitMiddleware } from "../types";

export const conduitChangeRequestHeadersMiddleware = (
  mode: ChangeCase = "header",
): ConduitMiddleware =>
  async function conduitChangeRequestHeadersMiddleware(ctx, next) {
    const { headers } = ctx.req;

    if (Object.keys(headers).length) {
      ctx.req.headers = changeKeys(headers, mode);
    }

    await next();
  };
