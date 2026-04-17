import { ConduitMiddleware, ConduitResponse } from "../../types";
import { composeAxiosConfig } from "../utils/compose-axios-config";
import { requestWithRetry } from "../utils/request-with-retry";
import { useAxios } from "../utils/use-axios";

export const axiosRequestHandler: ConduitMiddleware = async (ctx, next) => {
  const config = await composeAxiosConfig(ctx);

  const fn = async (): Promise<ConduitResponse> => useAxios(config);

  ctx.res = await requestWithRetry(fn, ctx);

  await next();
};
