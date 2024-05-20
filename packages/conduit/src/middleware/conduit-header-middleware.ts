import { Header } from "@lindorm/types";
import { ConduitMiddleware } from "../types";

export const conduitHeaderMiddleware =
  (header: string, content: Header): ConduitMiddleware =>
  async (ctx, next) => {
    ctx.req.headers[header] = content;

    await next();
  };
