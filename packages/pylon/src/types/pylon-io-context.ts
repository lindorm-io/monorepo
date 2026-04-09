import { PylonSocket, PylonSocketData } from "./pylon-socket";
import { IoServer } from "./socket";

export type PylonIoContextHttp = {
  app: IoServer;
};

export type PylonIoContextSocket<D extends PylonSocketData = PylonSocketData> = {
  app: IoServer;
  socket: PylonSocket<D>;
};
