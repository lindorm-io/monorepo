import { createUrl } from "@lindorm/url";
import { REPLACE_URL } from "../../constants/private";
import { ConduitContext } from "../../types";
import { composeFetchData } from "./compose-fetch-data";

type Composed = {
  input: string;
  init: RequestInit;
};

export const composeFetchConfig = (ctx: ConduitContext): Composed => {
  if (ctx.req.stream) {
    throw new Error("Stream requests are not supported when using fetch");
  }

  const { body, headers } = composeFetchData(ctx);

  return {
    input: createUrl(ctx.req.url, {
      baseUrl: ctx.app.baseURL ?? REPLACE_URL,
      params: ctx.req.params,
      query: ctx.req.query,
    })
      .toString()
      .replace(REPLACE_URL, ""),
    init: {
      body,
      cache: ctx.req.config.cache,
      credentials: ctx.req.config.credentials,
      headers: { ...headers, ...ctx.req.headers },
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
