import {
  Axios,
  axiosRequestLoggerMiddleware,
  Middleware as AxiosMiddleware,
} from "@lindorm-io/axios";
import { AxiosMiddlewareConfig, DefaultLindormAxiosKoaMiddleware } from "../types";

export const axiosMiddleware =
  (config: AxiosMiddlewareConfig): DefaultLindormAxiosKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const start = Date.now();

    const metadataMiddleware: AxiosMiddleware = async (axiosCtx, axiosNext) => {
      axiosCtx.req.headers = { ...axiosCtx.req.headers, ...ctx.getMetadataHeaders() };

      await axiosNext();
    };

    ctx.axios[config.clientName] = new Axios({
      host: config.host,
      port: config.port,
      middleware: [
        axiosRequestLoggerMiddleware(ctx.logger),
        metadataMiddleware,
        ...(config.middleware || []),
      ],
      name: config.clientName,
    });

    ctx.metrics.axios = (ctx.metrics.axios || 0) + (Date.now() - start);

    await next();
  };
