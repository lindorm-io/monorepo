import { ConduitMiddleware } from "../../types";

export const requestLogger: ConduitMiddleware = async (ctx, next) => {
  ctx.logger?.verbose("Conduit request sent", {
    app: ctx.app,
    request: {
      body: ctx.req.body ? ctx.req.body : {},
      config: ctx.req.config,
      form: ctx.req.form ? ctx.req.form : {},
      headers: ctx.req.headers,
      metadata: ctx.req.metadata,
      params: ctx.req.params,
      query: ctx.req.query,
      retryConfig: ctx.req.retryConfig,
      stream: ctx.req.stream ? Object.keys(ctx.req.stream) : {},
      url: ctx.req.url,
    },
  });

  await next();
};
