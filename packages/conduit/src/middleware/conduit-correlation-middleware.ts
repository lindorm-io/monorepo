import type { ConduitMiddleware } from "../types/index.js";

export const conduitCorrelationMiddleware = (correlationId: string): ConduitMiddleware =>
  async function conduitCorrelationMiddleware(ctx, next) {
    ctx.req.metadata.correlationId = correlationId;

    await next();
  };
