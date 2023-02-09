import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { DefaultLindormContext } from "./lindorm-context";
import { ExtendedError } from "socket.io/dist/namespace";
import { Server, Socket } from "socket.io";

export type IOServer<Data = any> = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  Data
>;

export type IOSocket<Data = any> = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  Data
>;

export interface DefaultLindormSocket<
  Context extends DefaultLindormContext = DefaultLindormContext,
  Data = any,
> extends IOSocket<Data> {
  ctx: Context;
}

export type LindormSocketPromise<
  Socket extends DefaultLindormSocket = DefaultLindormSocket,
  Options = any,
> = (socket: Socket, options?: Options) => Promise<void>;

export type SocketMiddlewareNext = (err?: ExtendedError) => void;

export type DefaultLindormSocketMiddleware<
  Socket extends DefaultLindormSocket = DefaultLindormSocket,
> = (socket: Socket, next: SocketMiddlewareNext) => void;
