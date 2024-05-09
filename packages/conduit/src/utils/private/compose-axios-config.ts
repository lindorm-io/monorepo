import { createUrl } from "@lindorm/url";
import type { RawAxiosRequestConfig } from "axios";
import type { ConduitContext } from "../../types";
import { _composeAxiosData } from "./compose-axios-data";

export const _composeAxiosConfig = async (ctx: ConduitContext): Promise<RawAxiosRequestConfig> => {
  const { data, headers } = await _composeAxiosData(ctx);

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
