import { AxiosContext } from "../types";
import { Middleware } from "@lindorm-io/koa";
import { Axios, AxiosMiddleware } from "@lindorm-io/axios";

interface MiddlewareOptions {
  baseUrl?: string;
  clientName: string;
  middleware?: Array<AxiosMiddleware>;
}

export const axiosMiddleware =
  (middlewareOptions: MiddlewareOptions): Middleware<AxiosContext> =>
  async (ctx, next): Promise<void> => {
    const start = Date.now();

    const metadataMiddleware: AxiosMiddleware = {
      request: async (request) => ({
        ...request,
        headers: {
          ...request.headers,
          ...ctx.getMetadataHeaders(),
        },
      }),
    };

    ctx.axios[middlewareOptions.clientName] = new Axios({
      baseUrl: middlewareOptions.baseUrl,
      logger: ctx.logger,
      middleware: [metadataMiddleware, ...(middlewareOptions.middleware || [])],
      name: middlewareOptions.clientName,
    });

    ctx.metrics.axios = (ctx.metrics.axios || 0) + (Date.now() - start);

    await next();
  };
