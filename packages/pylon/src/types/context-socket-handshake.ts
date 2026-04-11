import { ILogger } from "@lindorm/logger";
import { Middleware } from "@lindorm/middleware";
import { PylonCommonContext, PylonState } from "./context-common";
import { PylonIoContextSocket } from "./pylon-io-context";
import { PylonSocketData } from "./pylon-socket";

export type PylonSocketHandshakeContextBase<D extends PylonSocketData = PylonSocketData> =
  {
    eventId: string;
    io: PylonIoContextSocket<D>;
    logger?: ILogger;
  };

export type PylonSocketHandshakeContext<D extends PylonSocketData = PylonSocketData> =
  PylonSocketHandshakeContextBase<D> &
    PylonCommonContext & {
      state: PylonState;
    };

export type PylonConnectionMiddleware<
  C extends PylonSocketHandshakeContext = PylonSocketHandshakeContext,
> = Middleware<C>;
