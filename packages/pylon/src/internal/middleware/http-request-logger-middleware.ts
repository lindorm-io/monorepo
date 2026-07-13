import { redactHeaders } from "../utils/redact/redact-headers.js";
import type { PylonHttpMiddleware } from "../../types/index.js";

export const httpRequestLoggerMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  ctx.logger.verbose("Service request", {
    metadata: ctx.state.metadata,
    request: {
      body: ctx.request.body,
      header: redactHeaders(ctx.request.header),
      method: ctx.request.method,
      query: ctx.query,
      url: ctx.request.url,
    },
  });

  await next();
};
