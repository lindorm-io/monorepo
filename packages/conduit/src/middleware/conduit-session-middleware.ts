import { ConduitMiddleware } from "../types";

export const conduitSessionMiddleware = (sessionId: string): ConduitMiddleware =>
  async function conduitSessionMiddleware(ctx, next) {
    ctx.req.metadata.sessionId = sessionId;

    await next();
  };
