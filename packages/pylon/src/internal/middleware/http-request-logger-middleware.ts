import { PylonHttpMiddleware } from "../../types";

export const httpRequestLoggerMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  ctx.logger.info("Service request", {
    metadata: ctx.state.metadata,
    request: {
      body: ctx.request.body,
      header: ctx.request.header,
      method: ctx.request.method,
      query: ctx.query,
      url: ctx.request.url,
    },
  });

  await next();
};
