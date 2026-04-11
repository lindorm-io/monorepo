import { randomUUID } from "crypto";
import {
  IoServer,
  PylonSocket,
  PylonSocketData,
  PylonSocketHandshakeContextBase,
} from "../../../types";

export const composePylonHandshakeContext = <D extends PylonSocketData = PylonSocketData>(
  io: IoServer,
  socket: PylonSocket<D>,
): PylonSocketHandshakeContextBase<D> => {
  return {
    handshakeId: randomUUID(),
    io: { app: io, socket },
  };
};
