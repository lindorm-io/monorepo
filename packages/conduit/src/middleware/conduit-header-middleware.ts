import { ConduitMiddleware } from "../types";

export const conduitHeaderMiddleware = (
  header: string,
  content: string,
): ConduitMiddleware =>
  async function conduitHeaderMiddleware(ctx, next) {
    ctx.req.headers[header] = content;

    await next();
  };
