import {
  DefaultLindormContext,
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
} from "../../types";

interface CustomContext extends DefaultLindormContext {
  jwt: undefined;
  logger: undefined;
}

interface CustomSocket extends DefaultLindormSocket {
  ctx: CustomContext;
}

export const initSocketContextMiddleware: DefaultLindormSocketMiddleware<CustomSocket> = (
  socket,
  next,
) => {
  socket.ctx = {
    axios: {},
    cache: {},
    connection: {},
    entity: {},
    jwt: undefined,
    keys: [],
    keystore: undefined,
    logger: undefined,
    messageBus: undefined,
    repository: {},
    token: {},
  };

  next();
};
