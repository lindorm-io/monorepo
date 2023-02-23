import { Middleware } from "../../types";
import { composeAxiosConfig, requestWithRetry } from "../../util/private";

export const axiosRequestHandler: Middleware = async (ctx, next) => {
  const config = composeAxiosConfig(ctx);
  const retryOptions = ctx.req.retry;
  const retryCallback = ctx.req.retryCallback;

  ctx.res = await requestWithRetry(config, retryOptions, retryCallback, 1);

  await next();
};
