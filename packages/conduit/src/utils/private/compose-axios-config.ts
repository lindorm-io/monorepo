import { createUrl } from "@lindorm/url";
import type { RawAxiosRequestConfig } from "axios";
import type { ConduitContext } from "../../types";
import { composeAxiosData } from "./compose-axios-data";

export const composeAxiosConfig = async (
  ctx: ConduitContext,
): Promise<RawAxiosRequestConfig> => {
  const { data, headers } = await composeAxiosData(ctx);

  return {
    ...ctx.req.config,
    data,
    headers: { ...ctx.req.headers, ...headers },
    url: createUrl(ctx.req.url, {
      params: ctx.req.params,
      query: ctx.req.query,
    }).toString(),
  };
};
