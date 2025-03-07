import { ConduitMiddleware, ConduitResponse } from "../../types";
import { composeAxiosConfig, requestWithRetry, useAxios } from "../../utils/private";

export const axiosRequestHandler: ConduitMiddleware = async (ctx, next) => {
  const config = await composeAxiosConfig(ctx);

  const fn = async (): Promise<ConduitResponse> => useAxios(config);

  ctx.res = await requestWithRetry(fn, ctx);

  await next();
};
