import { Middleware } from "@lindorm/middleware";
import { PylonCommonContext } from "./context-common";
import { PylonSocket, PylonSocketData } from "./pylon-socket";
import { IoServer } from "./socket";

export type PylonSocketContextBase<Args, Data extends PylonSocketData> = {
  args: Args;
  event: string;
  eventId: string;
  io: IoServer;
  socket: PylonSocket<Data>;
};

export type PylonSocketContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonSocketContextBase<Args, Data> & PylonCommonContext;

export type PylonSocketMiddleware<C extends PylonSocketContext = PylonSocketContext> =
  Middleware<C>;
