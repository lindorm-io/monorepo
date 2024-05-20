import { ConduitMiddleware } from "../types";

export const conduitCorrelationMiddleware =
  (correlationId: string): ConduitMiddleware =>
  async (ctx, next) => {
    ctx.req.metadata.correlationId = correlationId;

    await next();
  };
