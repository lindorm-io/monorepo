import { ILogger } from "@lindorm-io/winston";
import { DefaultLindormSocketMiddleware } from "../../types";

export const socketLoggerMiddleware =
  (logger: ILogger): DefaultLindormSocketMiddleware =>
  (socket, next) => {
    socket.ctx.logger = logger.createSessionLogger({
      socketId: socket.id,
    });

    next();
  };
