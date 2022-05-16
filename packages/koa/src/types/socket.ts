import { DefaultLindormContext } from "./lindorm-context";
import { ExtendedError } from "socket.io/dist/namespace";
import { Server, Socket } from "socket.io";

export interface DefaultLindormSocket<
  Context extends DefaultLindormContext = DefaultLindormContext,
  Data = any,
> extends Socket {
  ctx: Context;
  data: Data;
}

export type LindormSocketPromise<
  Socket extends DefaultLindormSocket = DefaultLindormSocket,
  Options = any,
> = (socket: Socket, options?: Options) => Promise<void>;

export type SocketMiddlewareNext = (err?: ExtendedError) => void;

export type DefaultLindormSocketMiddleware<
  Socket extends DefaultLindormSocket = DefaultLindormSocket,
> = (socket: Socket, next: SocketMiddlewareNext) => void;

export type IOServer = Server;
