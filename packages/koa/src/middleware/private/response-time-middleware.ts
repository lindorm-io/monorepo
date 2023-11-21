import { DefaultLindormMiddleware } from "../../types";

export const responseTimeMiddleware: DefaultLindormMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const metric = ctx.getMetric("responseTime");
  const startTime = Date.now();

  try {
    await next();
  } finally {
    metric.end();

    ctx.set("X-Start-Time", startTime.toString());
    ctx.set("X-Current-Time", Date.now().toString());
    ctx.set("X-Response-Time", `${ctx.metrics.responseTime}ms`);
  }
};
