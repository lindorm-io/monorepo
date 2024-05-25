import { Header } from "@lindorm/types";
import { ConduitMiddleware } from "../types";

export const conduitHeaderMiddleware = (
  header: string,
  content: Header,
): ConduitMiddleware =>
  async function conduitHeaderMiddleware(ctx, next) {
    ctx.req.headers[header] = content;

    await next();
  };
