import { ConduitMiddleware, ConduitResponse } from "../../types";
import { composeFetchConfig } from "../../utils/private/compose-fetch-config";
import { requestWithRetry } from "../../utils/private/request-with-retry";
import { useFetch } from "../../utils/private/use-fetch";

export const fetchRequestHandler: ConduitMiddleware = async (ctx, next) => {
  const fn = async (): Promise<ConduitResponse> => {
    const { input, init } = composeFetchConfig(ctx);
    return useFetch(input, init, ctx.req.config);
  };

  ctx.res = await requestWithRetry(fn, ctx);

  await next();
};
