import { Logger } from "@lindorm-io/winston";
import { DefaultLindormSocketMiddleware } from "../../types";

export const socketLoggerMiddleware =
  (winston: Logger): DefaultLindormSocketMiddleware =>
  (socket, next) => {
    socket.lindorm = {
      ...(socket.lindorm || {}),
      logger: winston.createSessionLogger({
        socketId: socket.id,
      }),
    };
    next();
  };
