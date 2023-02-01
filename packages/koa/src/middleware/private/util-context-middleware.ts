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
  ctx.deleteCookie = deleteCookie.bind(ctx);
  ctx.getAuthorizationHeader = getAuthorizationHeader.bind(ctx);
  ctx.getCookie = getCookie.bind(ctx);
  ctx.getMetadataHeaders = getMetadataHeaders.bind(ctx);
  ctx.getMetric = (key: string): Metric => new Metric(ctx, key);
  ctx.setCookie = setCookie.bind(ctx);

  await next();
};
