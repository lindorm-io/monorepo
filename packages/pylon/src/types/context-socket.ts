import type { Middleware } from "@lindorm/middleware";
import type { Dict } from "@lindorm/types";
import type { PylonCommonContext, PylonState } from "./context-common.js";
import type { PylonIoContextSocket } from "./pylon-io-context.js";
import type { PylonSocketData } from "./pylon-socket.js";
import type { PylonSocketEmitterWithBroadcast } from "./pylon-socket-emitter.js";

export type PylonEnvelopeHeader = {
  correlationId?: string;
  [key: string]: unknown;
};

export type PylonRoomContextHttp = {
  members: (room: string) => Promise<Array<string>>;
  presence?: (
    room: string,
  ) => Promise<Array<{ userId: string; socketId: string; joinedAt: Date }>>;
};

export type PylonRoomContextSocket = {
  join: (room: string) => Promise<void>;
  leave: (room: string) => Promise<void>;
  members: (room: string) => Promise<Array<string>>;
  presence?: (
    room: string,
  ) => Promise<Array<{ userId: string; socketId: string; joinedAt: Date }>>;
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
  io: PylonIoContextSocket<Data>;
  nack: ((error: any) => void) | null;
  params: Dict<string>;
  rooms?: PylonRoomContextSocket;
  socket?: PylonSocketEmitterWithBroadcast;
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
