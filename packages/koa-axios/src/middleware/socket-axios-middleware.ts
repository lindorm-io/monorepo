import { Axios } from "@lindorm-io/axios";
import { getSocketError } from "@lindorm-io/koa";
import { AxiosMiddlewareConfig, DefaultLindormAxiosSocketMiddleware } from "../types";

export const socketAxiosMiddleware =
  ({ alias, ...config }: AxiosMiddlewareConfig): DefaultLindormAxiosSocketMiddleware =>
  (socket, next): void => {
    try {
      socket.ctx.axios[alias] = new Axios(
        {
          ...config,
          middleware: config.middleware,
        },
        socket.ctx.logger,
      );

      next();
    } catch (err: any) {
      next(getSocketError(socket, err));
    }
  };
