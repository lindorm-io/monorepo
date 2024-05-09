import { Dict, Header } from "@lindorm/types";
import { ConduitMiddleware } from "../../types";

export const conduitHeadersMiddleware =
  (headers: Dict<Header>): ConduitMiddleware =>
  async (ctx, next) => {
    ctx.req.headers = { ...ctx.req.headers, ...headers };

    await next();
  };
