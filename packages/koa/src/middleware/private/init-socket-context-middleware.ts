import { DefaultLindormSocketMiddleware } from "../../types";
import { Logger } from "@lindorm-io/core-logger";

export const initSocketContextMiddleware =
  (logger: Logger): DefaultLindormSocketMiddleware =>
  (socket, next) => {
    socket.ctx = {
      axios: {},
      cache: {},
      connection: {},
      entity: {},
      eventSource: undefined,
      jwt: undefined,
      keys: [],
      keystore: undefined,
      logger: logger.createSessionLogger({ socketId: socket.id }),
      messageBus: undefined,
      repository: {},
      token: {},
    };

    next();
  };
