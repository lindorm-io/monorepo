import { Middleware } from "../../types";

export const axiosCorrelationMiddleware =
  (correlationId: string): Middleware =>
  async (ctx, next) => {
    ctx.req.correlationId = correlationId;

    await next();
  };
