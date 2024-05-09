import { createUrl } from "@lindorm/url";
import { ConduitContext } from "../../types";

type Composed = {
  input: URL;
  init: RequestInit;
};

export const _composeFetchConfig = (ctx: ConduitContext): Composed => {
  if (ctx.req.stream) {
    throw new Error("Stream requests are not supported when using fetch");
  }

  return {
    input: createUrl(ctx.req.url, {
      params: ctx.req.params,
      query: ctx.req.query,
    }),
    init: {
      body: ctx.req.form
        ? ctx.req.form
        : ctx.req.body && Object.keys(ctx.req.body).length
          ? JSON.stringify(ctx.req.body)
          : undefined,
      cache: ctx.req.config.cache,
      credentials: ctx.req.config.credentials,
      headers: ctx.req.headers,
      integrity: ctx.req.config.integrity,
      keepalive: ctx.req.config.keepalive,
      method: ctx.req.config.method,
      mode: ctx.req.config.mode,
      priority: ctx.req.config.priority,
      redirect: ctx.req.config.redirect,
      referrer: ctx.req.config.referrer,
      referrerPolicy: ctx.req.config.referrerPolicy,
      window: ctx.req.config.window,
    },
  };
};
