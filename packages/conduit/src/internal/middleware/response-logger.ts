import { LindormError } from "@lindorm/errors";
import { isObject, isObjectLike, isString } from "@lindorm/is";
import { redactData } from "../utils/redact-data.js";
import { redactHeaders } from "../utils/redact-headers.js";
import type { ConduitMiddleware } from "../../types/index.js";

type Transport = {
  config?: any;
  request?: any;
  response?: any;
};

export const responseLogger: ConduitMiddleware = async (ctx, next) => {
  const start = Date.now();

  try {
    await next();

    ctx.logger?.verbose("Conduit request successful", {
      app: ctx.app,
      request: {
        body: ctx.req.body ? redactData(ctx.req.body) : {},
        config: ctx.req.config,
        form: ctx.req.form ? ctx.req.form : {},
        headers: redactHeaders(ctx.req.headers),
        metadata: ctx.req.metadata,
        origin: ctx.req.origin,
        params: ctx.req.params,
        query: ctx.req.query,
        retryConfig: ctx.req.retryConfig,
        stream: ctx.req.stream ? Object.keys(ctx.req.stream) : {},
        url: ctx.req.url,
      },
      response: {
        data:
          isObject(ctx.res?.data) || isString(ctx.res?.data)
            ? redactData(ctx.res?.data)
            : isObjectLike(ctx.res?.data)
              ? "[Stream]"
              : ctx.res?.data,
        headers: redactHeaders(ctx.res?.headers),
        status: ctx.res?.status,
        statusText: ctx.res?.statusText,
      },
      time: Date.now() - start,
    });
  } catch (err: any) {
    if (err instanceof LindormError) {
      // `transport` is built by `reconstructFromAxiosError`, which redacts its own
      // headers / data — the error is thrown to the caller, so it must be safe at source.
      const transport = (err.debug?.transport ?? {}) as Transport;

      ctx.logger?.warn("Conduit request failed", {
        app: ctx.app,
        request: {
          body: ctx.req.body ? redactData(ctx.req.body) : {},
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
        config: transport.config,
        response: {
          data: transport.response?.data,
          headers: transport.response?.headers,
          status: transport.response?.status || err.status,
          statusText: transport.response?.statusText,
        },
        time: Date.now() - start,
      });
    } else {
      ctx.logger?.error("Conduit request exception", err);
    }

    throw err;
  }
};
