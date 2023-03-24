import { DefaultLindormMiddleware, KoaAppOptions } from "../../types";
import { Environment } from "@lindorm-io/common-types";

export const initContextMiddleware =
  (options: KoaAppOptions<any>): DefaultLindormMiddleware<any> =>
  async (ctx, next): Promise<void> => {
    ctx.axios = {};
    ctx.config = {
      transformMode: options.transformMode || "snake",
    };
    ctx.connection = {};
    ctx.entity = {};
    ctx.keys = [];
    ctx.memory = {};
    ctx.metrics = {};
    ctx.mongo = {};
    ctx.redis = {};
    ctx.server = {
      domain: options.domain || options.host,
      environment: options.environment || Environment.DEVELOPMENT,
      host: options.host,
    };
    ctx.token = {};

    await next();
  };
