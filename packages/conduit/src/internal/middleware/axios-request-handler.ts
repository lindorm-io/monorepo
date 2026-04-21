import type { ConduitMiddleware, ConduitResponse } from "../../types/index.js";
import { composeAxiosConfig } from "../utils/compose-axios-config.js";
import { requestWithRetry } from "../utils/request-with-retry.js";
import { useAxios } from "../utils/use-axios.js";

export const axiosRequestHandler: ConduitMiddleware = async (ctx, next) => {
  const config = await composeAxiosConfig(ctx);

  const fn = async (): Promise<ConduitResponse> => useAxios(config);

  ctx.res = await requestWithRetry(fn, ctx);

  await next();
};
