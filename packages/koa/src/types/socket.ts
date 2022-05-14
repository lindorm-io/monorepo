import { DefaultEventsMap, EventsMap } from "socket.io/dist/typed-events";
import { ExtendedError } from "socket.io/dist/namespace";
import { Logger } from "@lindorm-io/winston";
import { Socket } from "socket.io/dist/socket";

export interface DefaultLindormSocketContext {
  logger: Logger;
}

export interface DefaultLindormSocket<
  ListenEvents extends EventsMap = DefaultEventsMap,
  EmitEvents extends EventsMap = ListenEvents,
  ServerSideEvents extends EventsMap = DefaultEventsMap,
  SocketData = any,
> extends Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData> {
  lindorm: DefaultLindormSocketContext;
}

export type LindormSocketPromise<Options = any> = (
  socket: DefaultLindormSocket,
  options: Options,
) => Promise<void>;

export type SocketMiddlewareNext = (err?: ExtendedError) => void;

export type DefaultLindormSocketMiddleware<
  Socket extends DefaultLindormSocket = DefaultLindormSocket,
> = (socket: Socket, next: SocketMiddlewareNext) => void;
