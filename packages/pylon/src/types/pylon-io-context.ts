import type { PylonSocket, PylonSocketData } from "./pylon-socket.js";
import type { IoServer } from "./socket.js";

export type PylonIoContextHttp = {
  app: IoServer;
};

export type PylonIoContextSocket<D extends PylonSocketData = PylonSocketData> = {
  app: IoServer;
  socket: PylonSocket<D>;
};
