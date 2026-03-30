import { ConduitMiddleware, ConduitResponse } from "../../types";
import { composeFetchConfig } from "#internal/utils/compose-fetch-config";
import { requestWithRetry } from "#internal/utils/request-with-retry";
import { useFetch } from "#internal/utils/use-fetch";

export const fetchRequestHandler: ConduitMiddleware = async (ctx, next) => {
  const { input, init } = composeFetchConfig(ctx);

  const fn = async (): Promise<ConduitResponse> =>
    useFetch(input, init, {
      config: ctx.req.config,
      onDownloadProgress: ctx.req.onDownloadProgress,
      stream: ctx.req.config.responseType === "stream",
    });

  ctx.res = await requestWithRetry(fn, ctx);

  await next();
};
