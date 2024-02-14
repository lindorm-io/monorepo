import { DefaultLindormMiddleware } from "../../types";

export const responseTimeMiddleware: DefaultLindormMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const startTime = Date.now();

  try {
    await next();
  } finally {
    const endTime = Date.now();

    ctx.set("X-Start-Time", startTime.toString());
    ctx.set("X-Current-Time", endTime.toString());
    ctx.set("X-Response-Time", `${endTime - startTime}ms`);
  }
};
