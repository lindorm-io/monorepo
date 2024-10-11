import axios from "axios";
import { ConduitMiddleware, ConduitResponse } from "../../types";
import { composeAxiosConfig, requestWithRetry } from "../../utils/private";

export const axiosRequestHandler: ConduitMiddleware = async (ctx, next) => {
  const fn = async (): Promise<ConduitResponse> =>
    await axios.request(await composeAxiosConfig(ctx));

  ctx.res = await requestWithRetry(fn, ctx);

  await next();
};
