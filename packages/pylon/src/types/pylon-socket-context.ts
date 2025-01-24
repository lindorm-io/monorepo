import { IAegis } from "@lindorm/aegis";
import { IAmphora } from "@lindorm/amphora";
import { IConduit } from "@lindorm/conduit";
import { ILogger } from "@lindorm/logger";
import { Middleware } from "@lindorm/middleware";
import { PylonSocket, PylonSocketData } from "./pylon-socket";
import { IoServer } from "./socket";

type Conduits = {
  conduit: IConduit;
  [key: string]: IConduit;
};

export type PylonSocketContextBase<Args, Data extends PylonSocketData> = {
  args: Args;
  event: string;
  eventId: string;
  io: IoServer;
  socket: PylonSocket<Data>;
};

type Context = {
  aegis: IAegis;
  amphora: IAmphora;
  conduits: Conduits;
  logger: ILogger;
};

export type PylonSocketContext<
  Args = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonSocketContextBase<Args, Data> & Context;

export type PylonSocketMiddleware<C extends PylonSocketContext = PylonSocketContext> =
  Middleware<C>;
