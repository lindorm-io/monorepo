import type { ConduitMiddleware } from "../types/index.js";

export const conduitSessionMiddleware = (sessionId: string): ConduitMiddleware =>
  async function conduitSessionMiddleware(ctx, next) {
    ctx.req.metadata.sessionId = sessionId;

    await next();
  };
