import { Middleware } from "../types";
import { composeAxiosConfig } from "./compose-axios-config";
import { requestWithRetry } from "./request-with-retry";

export const axiosRequestHandler: Middleware = async (ctx, next) => {
  ctx.res = await requestWithRetry(
    composeAxiosConfig(ctx),
    ctx.req.retry,
    ctx.req.retryCallback,
    1,
  );

  await next();
};
