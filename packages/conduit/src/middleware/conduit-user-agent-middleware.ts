import type { ClientDeclared } from "@lindorm/types";
import { toClientHeaders } from "@lindorm/utils";
import type { ConduitMiddleware } from "../types/index.js";

export const conduitUserAgentMiddleware = (
  client: Partial<ClientDeclared>,
): ConduitMiddleware =>
  async function conduitUserAgentMiddleware(ctx, next) {
    Object.assign(ctx.req.headers, toClientHeaders(client));

    await next();
  };
