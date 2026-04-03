import { Middleware } from "@lindorm/middleware";
import { Dict } from "@lindorm/types";
import { PylonCommonContext, PylonState } from "./context-common";
import { PylonSocket, PylonSocketData } from "./pylon-socket";
import { IoServer } from "./socket";

export type PylonSocketContextBase<Args, Data extends PylonSocketData> = {
  args: Args;
  data: any;
  event: string;
  eventId: string;
  io: IoServer;
  params: Dict<string>;
  socket: PylonSocket<Data>;
};

export type PylonSocketContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonSocketContextBase<Args, Data> &
  PylonCommonContext & {
    state: PylonState;
  };

export type PylonSocketMiddleware<C extends PylonSocketContext = PylonSocketContext> =
  Middleware<C>;
