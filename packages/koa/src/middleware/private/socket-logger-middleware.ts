import { ILogger } from "@lindorm-io/winston";
import { DefaultLindormSocketMiddleware } from "../../types";

export const socketLoggerMiddleware =
  (winston: ILogger): DefaultLindormSocketMiddleware =>
  (socket, next) => {
    socket.ctx.logger = winston.createSessionLogger({
      socketId: socket.id,
    });

    next();
  };
