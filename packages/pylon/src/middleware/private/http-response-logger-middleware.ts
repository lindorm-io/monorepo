import { Stream } from "stream";
import { PylonHttpMiddleware } from "../../types";

export const httpResponseLoggerMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  try {
    await next();
  } finally {
    ctx.logger.info("Service response", {
      metadata: ctx.metadata,
      request: {
        body: ctx.request.body,
        files: ctx.request.files,
        header: ctx.request.header,
        method: ctx.request.method,
        params: ctx.params,
        query: ctx.query,
        url: ctx.request.url,
      },
      response: {
        body: ctx.response.body instanceof Stream ? "[Stream]" : ctx.response.body,
        header: ctx.response.header,
        message: ctx.response.message,
        status: ctx.response.status,
      },
    });
  }
};
