import { Axios, axiosRequestLoggerMiddleware } from "@lindorm-io/axios";
import { AxiosMiddlewareConfig, DefaultLindormAxiosSocketMiddleware } from "../types";
import { getSocketError } from "@lindorm-io/koa";

export const socketAxiosMiddleware =
  ({ alias, ...config }: AxiosMiddlewareConfig): DefaultLindormAxiosSocketMiddleware =>
  (socket, next): void => {
    try {
      socket.ctx.axios[alias] = new Axios({
        ...config,
        middleware: [axiosRequestLoggerMiddleware(socket.ctx.logger), ...(config.middleware || [])],
      });

      next();
    } catch (err: any) {
      next(getSocketError(socket, err));
    }
  };
