import {
  Axios,
  TransformMode,
  axiosClientPropertiesMiddleware,
  axiosCorrelationMiddleware,
  axiosRequestLoggerMiddleware,
  axiosTransformRequestBodyMiddleware,
  axiosTransformRequestQueryMiddleware,
  axiosTransformResponseDataMiddleware,
} from "@lindorm-io/axios";
import { AxiosMiddlewareConfig, DefaultLindormAxiosKoaMiddleware } from "../types";

export const axiosMiddleware =
  ({ alias, ...config }: AxiosMiddlewareConfig): DefaultLindormAxiosKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const start = Date.now();

    ctx.axios[alias] = new Axios({
      ...config,
      middleware: [
        axiosClientPropertiesMiddleware({
          id: config.client?.id,
          environment: ctx.server.environment,
          name: config.client?.name,
          platform: config.client?.platform,
          version: config.client?.version,
        }),
        axiosCorrelationMiddleware(ctx.metadata.identifiers.correlationId),
        axiosTransformRequestBodyMiddleware(TransformMode.SNAKE),
        axiosTransformRequestQueryMiddleware(TransformMode.SNAKE),
        axiosTransformResponseDataMiddleware(TransformMode.CAMEL),
        axiosRequestLoggerMiddleware(ctx.logger),
        ...(config.middleware || []),
      ],
    });

    ctx.metrics.axios = (ctx.metrics.axios || 0) + (Date.now() - start);

    await next();
  };
