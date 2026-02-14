import { isObject, isObjectLike, isString } from "@lindorm/is";
import { ConduitError } from "../../errors";
import { ConduitMiddleware } from "../../types";
import { redactHeaders } from "../../utils/private";

export const responseLogger: ConduitMiddleware = async (ctx, next) => {
  const start = Date.now();

  try {
    await next();

    ctx.logger?.verbose("Conduit request successful", {
      app: ctx.app,
      request: {
        body: ctx.req.body ? ctx.req.body : {},
        config: ctx.req.config,
        form: ctx.req.form ? ctx.req.form : {},
        headers: redactHeaders(ctx.req.headers),
        metadata: ctx.req.metadata,
        params: ctx.req.params,
        query: ctx.req.query,
        retryConfig: ctx.req.retryConfig,
        stream: ctx.req.stream ? Object.keys(ctx.req.stream) : {},
        url: ctx.req.url,
      },
      response: {
        data:
          isObject(ctx.res?.data) || isString(ctx.res?.data)
            ? ctx.res?.data
            : isObjectLike(ctx.res?.data)
              ? "[Stream]"
              : ctx.res?.data,
        headers: ctx.res?.headers ? redactHeaders(ctx.res.headers) : undefined,
        status: ctx.res?.status,
        statusText: ctx.res?.statusText,
      },
      time: Date.now() - start,
    });
  } catch (err: any) {
    if (err instanceof ConduitError) {
      ctx.logger?.warn("Conduit request failed", {
        app: ctx.app,
        request: {
          body: ctx.req.body ? ctx.req.body : {},
          config: ctx.req.config,
          form: ctx.req.form ? ctx.req.form : {},
          headers: redactHeaders(ctx.req.headers),
          metadata: ctx.req.metadata,
          params: ctx.req.params,
          query: ctx.req.query,
          retryConfig: ctx.req.retryConfig,
          stream: ctx.req.stream ? Object.keys(ctx.req.stream) : {},
          url: ctx.req.url,
        },
        code: err.code,
        config: err.config,
        response: {
          data: err.response?.data,
          headers: err.response?.headers
            ? redactHeaders(err.response.headers)
            : undefined,
          status: err.response?.status || err.status,
          statusText: err.response?.statusText,
        },
        time: Date.now() - start,
      });
    } else {
      ctx.logger?.error("Conduit request exception", err);
    }

    throw err;
  }
};
