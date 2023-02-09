import { AxiosMiddlewareConfig, DefaultLindormAxiosSocketMiddleware } from "../types";
import { Axios, axiosRequestLoggerMiddleware } from "@lindorm-io/axios";
import { getSocketError } from "@lindorm-io/koa";

export const socketAxiosMiddleware =
  (config: AxiosMiddlewareConfig): DefaultLindormAxiosSocketMiddleware =>
  (socket, next): void => {
    try {
      socket.ctx.axios[config.clientName] = new Axios({
        host: config.host,
        port: config.port,
        middleware: [axiosRequestLoggerMiddleware(socket.ctx.logger), ...(config.middleware || [])],
        name: config.clientName,
      });

      next();
    } catch (err:any) {
      next(getSocketError(socket, err));
    }
  };
