import type { ILogger } from "@lindorm/logger";
import type { Middleware } from "@lindorm/middleware";
import type { PylonCommonContext, PylonState } from "./context-common.js";
import type { PylonIoContextSocket } from "./pylon-io-context.js";
import type { PylonSocketData } from "./pylon-socket.js";

export type PylonSocketHandshakeContextBase<D extends PylonSocketData = PylonSocketData> =
  {
    handshakeId: string;
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
