import { Context } from "../types";
import { AxiosRequestConfig } from "axios";
import { createURL } from "./create-url";

export const composeAxiosConfig = (ctx: Context): AxiosRequestConfig => ({
  auth: ctx.req.auth,
  data: ctx.req.body,
  headers: ctx.req.headers,
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
