import { RawAxiosRequestConfig } from "axios";
import { Context } from "../types";
import { createURL } from "@lindorm-io/url";

export const composeAxiosConfig = (ctx: Context): RawAxiosRequestConfig => ({
  auth: ctx.req.auth,
  data: ctx.req.body,
  headers: ctx.req.headers,
  method: ctx.req.method,
  timeout: ctx.req.timeout,
  url: createURL(ctx.req.path, {
    host: ctx.req.host,
    params: ctx.req.params,
    port: ctx.req.port,
    protocol: ctx.req.protocol,
    query: ctx.req.query,
  }).toString(),
  withCredentials: ctx.req.withCredentials,
  ...ctx.req.config,
});
