import { Dict } from "@lindorm/types";
import { Server, Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

export type IoServer<D extends Dict = Dict> = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  D
>;

export type IoSocket<D extends Dict = Dict> = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  D
>;
