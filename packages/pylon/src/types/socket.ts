import type { Dict } from "@lindorm/types";
import { Server, Socket } from "socket.io";

// socket.io's DefaultEventsMap lives on a private subpath that bundler
// moduleResolution refuses to traverse. Inline the same shape here.
type DefaultEventsMap = { [event: string]: (...args: any[]) => void };

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
