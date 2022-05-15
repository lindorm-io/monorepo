import { Logger } from "@lindorm-io/winston";
import { DefaultLindormSocketMiddleware } from "../../types";

export const socketLoggerMiddleware =
  (winston: Logger): DefaultLindormSocketMiddleware =>
  (socket, next) => {
    socket.ctx.logger = winston.createSessionLogger({
      socketId: socket.id,
    });

    next();
  };
