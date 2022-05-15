import { Axios, AxiosMiddleware } from "@lindorm-io/axios";
import { AxiosMiddlewareConfig, DefaultLindormAxiosKoaMiddleware } from "../types";

export const axiosMiddleware =
  (config: AxiosMiddlewareConfig): DefaultLindormAxiosKoaMiddleware =>
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

    ctx.axios[config.clientName] = new Axios({
      host: config.host,
      port: config.port,
      logger: ctx.logger,
      middleware: [metadataMiddleware, ...(config.middleware || [])],
      name: config.clientName,
    });

    ctx.metrics.axios = (ctx.metrics.axios || 0) + (Date.now() - start);

    await next();
  };
