import { ConduitMiddleware, ConduitResponse } from "../../types";
import { composeFetchConfig, requestWithRetry, useFetch } from "../../utils/private";

export const fetchRequestHandler: ConduitMiddleware = async (ctx, next) => {
  const fn = async (): Promise<ConduitResponse> => {
    const { input, init } = composeFetchConfig(ctx);
    return useFetch(input, init, ctx.req.config);
  };

  ctx.res = await requestWithRetry(fn, ctx);

  await next();
};
