import { Metric } from "../../class";
import { DefaultLindormMiddleware } from "../../types";
import {
  deleteCookie,
  getAuthorizationHeader,
  getCookie,
  getMetadataHeaders,
  setCookie,
} from "../../util/private";

export const utilContextMiddleware: DefaultLindormMiddleware = async (ctx, next): Promise<void> => {
  ctx.deleteCookie = deleteCookie(ctx);
  ctx.getAuthorizationHeader = getAuthorizationHeader(ctx);
  ctx.getCookie = getCookie(ctx);
  ctx.getMetadataHeaders = getMetadataHeaders(ctx);
  ctx.getMetric = (key: string): Metric => new Metric(ctx, key);
  ctx.setCookie = setCookie(ctx);

  await next();
};
