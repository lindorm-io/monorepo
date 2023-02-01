import { DefaultLindormMiddleware, KoaAppOptions } from "../../types";
import { Environment } from "../../enum";

export const initContextMiddleware =
  (options: KoaAppOptions): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    ctx.axios = {};
    ctx.config = {
      transformMode: options.transformMode || "snake",
    };
    ctx.cache = {};
    ctx.connection = {};
    ctx.entity = {};
    ctx.keys = [];
    ctx.metrics = {};
    ctx.repository = {};
    ctx.server = {
      domain: options.domain || options.host,
      environment: options.environment || Environment.DEVELOPMENT,
      host: options.host,
    };
    ctx.token = {};

    await next();
  };
