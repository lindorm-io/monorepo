import { Middleware } from "@lindorm/middleware";
import { Dict } from "@lindorm/types";
import { PylonCommonContext, PylonState } from "./context-common";
import { PylonSocket, PylonSocketData } from "./pylon-socket";
import { IoServer } from "./socket";

export type PylonEnvelopeHeader = {
  correlationId?: string;
  [key: string]: unknown;
};

export type PylonSocketContextBase<
  Payload = any,
  Data extends PylonSocketData = PylonSocketData,
> = {
  ack: ((data: any) => void) | null;
  args: any;
  data: Payload;
  envelope: boolean;
  event: string;
  eventId: string;
  header: PylonEnvelopeHeader;
  io: IoServer;
  nack: ((error: any) => void) | null;
  params: Dict<string>;
  socket: PylonSocket<Data>;
};

export type PylonSocketContext<
  Payload = any,
  Data extends PylonSocketData = PylonSocketData,
> = PylonSocketContextBase<Payload, Data> &
  PylonCommonContext & {
    state: PylonState;
  };

export type PylonSocketMiddleware<C extends PylonSocketContext = PylonSocketContext> =
  Middleware<C>;
