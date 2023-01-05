import { AxiosMiddlewareConfig, DefaultLindormAxiosSocketMiddleware } from "../types";
import { Axios } from "@lindorm-io/axios";
import { getSocketError } from "@lindorm-io/koa";

export const socketAxiosMiddleware =
  (config: AxiosMiddlewareConfig): DefaultLindormAxiosSocketMiddleware =>
  (socket, next): void => {
    try {
      socket.ctx.axios[config.clientName] = new Axios(
        {
          host: config.host,
          port: config.port,
          middleware: config.middleware,
          name: config.clientName,
        },
        socket.ctx.logger,
      );

      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
