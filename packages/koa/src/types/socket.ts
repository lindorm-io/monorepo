import { DefaultLindormContext } from "./lindorm-context";
import { ExtendedError } from "socket.io/dist/namespace";
import { Socket } from "socket.io/dist/socket";

export interface DefaultLindormSocket<
  Context extends DefaultLindormContext = DefaultLindormContext,
  Data extends Record<string, any> = Record<string, any>,
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
