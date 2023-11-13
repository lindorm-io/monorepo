import { createURL } from "@lindorm-io/url";
import { RawAxiosRequestConfig } from "axios";
import { Context } from "../../types";

export const composeAxiosConfig = (ctx: Context): RawAxiosRequestConfig => ({
  ...ctx.req.config,

  data: Object.keys(ctx.req.body).length ? ctx.req.body : undefined,
  headers: ctx.req.headers,
  url: createURL(ctx.req.url, {
    params: ctx.req.params,
    query: ctx.req.query,
  }).toString(),
});
