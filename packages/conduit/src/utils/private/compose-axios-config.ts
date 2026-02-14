import { createUrl } from "@lindorm/url";
import type { RawAxiosRequestConfig } from "axios";
import { REPLACE_URL } from "../../constants/private";
import type { ConduitContext } from "../../types";
import { composeAxiosData } from "./compose-axios-data";

export const composeAxiosConfig = async (
  ctx: ConduitContext,
): Promise<RawAxiosRequestConfig> => {
  const { data, headers } = await composeAxiosData(ctx);

  return {
    ...ctx.req.config,
    data,
    headers: { ...headers, ...ctx.req.headers },
    onDownloadProgress: ctx.req.onDownloadProgress,
    onUploadProgress: ctx.req.onUploadProgress,
    url: createUrl(ctx.req.url, {
      baseUrl: ctx.app.baseURL ?? REPLACE_URL,
      params: ctx.req.params,
      query: ctx.req.query,
    })
      .toString()
      .replace(REPLACE_URL, ""),
  };
};
