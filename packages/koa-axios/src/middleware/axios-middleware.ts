import { AxiosMiddlewareConfig, DefaultLindormAxiosKoaMiddleware } from "../types";
import {
  Axios,
  axiosClientPropertiesMiddleware,
  axiosCorrelationMiddleware,
  axiosRequestLoggerMiddleware,
  axiosTransformBodyCaseMiddleware,
  axiosTransformQueryCaseMiddleware,
} from "@lindorm-io/axios";

export const axiosMiddleware =
  ({ alias, ...config }: AxiosMiddlewareConfig): DefaultLindormAxiosKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const start = Date.now();

    ctx.axios[alias] = new Axios({
      ...config,
      middleware: [
        axiosClientPropertiesMiddleware({ environment: ctx.server.environment }),
        axiosCorrelationMiddleware(ctx.metadata.identifiers.correlationId),
        axiosTransformBodyCaseMiddleware(),
        axiosTransformQueryCaseMiddleware(),
        axiosRequestLoggerMiddleware(ctx.logger),
        ...(config.middleware || []),
      ],
    });

    ctx.metrics.axios = (ctx.metrics.axios || 0) + (Date.now() - start);

    await next();
  };
