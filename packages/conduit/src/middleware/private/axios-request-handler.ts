import axios from "axios";
import { ConduitMiddleware, ConduitResponse } from "../../types";
import { _composeAxiosConfig } from "../../utils/private/compose-axios-config";
import { _requestWithRetry } from "../../utils/private/request-with-retry";

export const _axiosRequestHandler: ConduitMiddleware = async (ctx, next) => {
  const fn = async (): Promise<ConduitResponse> =>
    await axios.request(await _composeAxiosConfig(ctx));

  ctx.res = await _requestWithRetry(fn, ctx);

  await next();
};
