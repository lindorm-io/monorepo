import type { PylonSocket, PylonSocketData } from "../socket/pylon-socket.js";
import type { IoServer } from "../socket/io.js";

export type PylonIoContextHttp = {
  app: IoServer;
};

export type PylonIoContextSocket<D extends PylonSocketData = PylonSocketData> = {
  app: IoServer;
  socket: PylonSocket<D>;
};
