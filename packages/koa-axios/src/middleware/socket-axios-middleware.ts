import { AxiosMiddlewareConfig, DefaultLindormAxiosSocketMiddleware } from "../types";
import { Axios } from "@lindorm-io/axios";
import { getSocketError } from "@lindorm-io/koa";

export const socketAxiosMiddleware =
  (config: AxiosMiddlewareConfig): DefaultLindormAxiosSocketMiddleware =>
  (socket, next): void => {
    try {
      socket.ctx.axios[config.clientName] = new Axios({
        host: config.host,
        port: config.port,
        logger: socket.ctx.logger,
        middleware: config.middleware,
        name: config.clientName,
      });

      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
