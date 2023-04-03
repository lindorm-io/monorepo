import { DefaultLindormMiddleware } from "../../types";
import { Metric } from "../../class";
import { getAuthorizationHeader } from "../../util/private";

export const utilContextMiddleware: DefaultLindormMiddleware = async (ctx, next): Promise<void> => {
  ctx.getAuthorizationHeader = getAuthorizationHeader(ctx);
  ctx.getMetric = (key: string): Metric => new Metric(ctx, key);

  await next();
};
