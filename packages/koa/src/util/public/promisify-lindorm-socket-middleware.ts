import { getSocketError } from "./get-socket-error";
import {
  DefaultLindormSocket,
  DefaultLindormSocketMiddleware,
  LindormSocketPromise,
  SocketMiddlewareNext,
} from "../../types";

export const promisifyLindormSocketMiddleware =
  <Socket extends DefaultLindormSocket = DefaultLindormSocket, Options = any>(
    promise: LindormSocketPromise<Socket, Options>,
    options?: Options,
  ): DefaultLindormSocketMiddleware<Socket> =>
  (socket: Socket, next: SocketMiddlewareNext) => {
    promise(socket, options)
      .then(() => next())
      .catch((err) => next(getSocketError(socket, err)));
  };
