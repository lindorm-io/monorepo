import { AxiosMiddlewareConfig, DefaultLindormAxiosSocketMiddleware } from "../types";
import { Axios } from "@lindorm-io/axios";

export const socketAxiosMiddleware =
  (config: AxiosMiddlewareConfig): DefaultLindormAxiosSocketMiddleware =>
  (socket, next): void => {
    socket.ctx.axios[config.clientName] = new Axios({
      host: config.host,
      port: config.port,
      logger: socket.ctx.logger,
      middleware: config.middleware,
      name: config.clientName,
    });

    next();
  };
