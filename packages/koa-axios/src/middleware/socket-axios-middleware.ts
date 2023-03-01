import { AxiosMiddlewareConfig, DefaultLindormAxiosSocketMiddleware } from "../types";
import { Axios, axiosRequestLoggerMiddleware } from "@lindorm-io/axios";
import { getSocketError } from "@lindorm-io/koa";

export const socketAxiosMiddleware =
  (config: AxiosMiddlewareConfig): DefaultLindormAxiosSocketMiddleware =>
  (socket, next): void => {
    try {
      socket.ctx.axios[config.clientName] = new Axios({
        ...config,
        middleware: [axiosRequestLoggerMiddleware(socket.ctx.logger), ...(config.middleware || [])],
      });

      next();
    } catch (err: any) {
      next(getSocketError(socket, err));
    }
  };
