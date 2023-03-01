import { AxiosMiddlewareConfig, DefaultLindormAxiosKoaMiddleware } from "../types";
import { removeEmptyFromObject } from "@lindorm-io/core";
import {
  Axios,
  axiosRequestLoggerMiddleware,
  Middleware as AxiosMiddleware,
} from "@lindorm-io/axios";

export const axiosMiddleware =
  (config: AxiosMiddlewareConfig): DefaultLindormAxiosKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const start = Date.now();

    const metadataMiddleware: AxiosMiddleware = async (axiosCtx, axiosNext) => {
      axiosCtx.req.headers = {
        ...axiosCtx.req.headers,
        ...removeEmptyFromObject(ctx.getMetadataHeaders()),
      };

      await axiosNext();
    };

    ctx.axios[config.clientName] = new Axios({
      ...config,
      middleware: [
        axiosRequestLoggerMiddleware(ctx.logger),
        metadataMiddleware,
        ...(config.middleware || []),
      ],
    });

    ctx.metrics.axios = (ctx.metrics.axios || 0) + (Date.now() - start);

    await next();
  };
