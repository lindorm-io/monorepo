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

    ctx.set("x-start-time", startTime.toString());
    ctx.set("x-current-time", Date.now().toString());
    ctx.set("x-response-time", `${ctx.metrics.responseTime}ms`);
  }
};
