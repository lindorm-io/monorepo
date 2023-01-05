import { Logger } from "@lindorm-io/core-logger";
import { DefaultLindormSocketMiddleware } from "../../types";

export const socketLoggerMiddleware =
  (logger: Logger): DefaultLindormSocketMiddleware =>
  (socket, next) => {
    socket.ctx.logger = logger.createSessionLogger({
      socketId: socket.id,
    });

    next();
  };
