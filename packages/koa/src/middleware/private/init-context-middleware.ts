import { DefaultLindormMiddleware, KoaAppOptions } from "../../types";
import { Environments } from "@lindorm-io/common-types";

export const initContextMiddleware =
  (options: KoaAppOptions<any>): DefaultLindormMiddleware<any> =>
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
      environment: options.environment || Environments.DEVELOPMENT,
      host: options.host,
    };
    ctx.token = {};

    await next();
  };
