import { ConduitMiddleware, ConduitResponse } from "../../types";
import { _composeFetchConfig } from "../../utils/private/compose-fetch-config";
import { _requestWithRetry } from "../../utils/private/request-with-retry";
import { _useFetch } from "../../utils/private/use-fetch";

export const _fetchRequestHandler: ConduitMiddleware = async (ctx, next) => {
  const fn = async (): Promise<ConduitResponse> => {
    const { input, init } = _composeFetchConfig(ctx);
    return _useFetch(input, init, ctx.req.config);
  };

  ctx.res = await _requestWithRetry(fn, ctx);

  await next();
};
