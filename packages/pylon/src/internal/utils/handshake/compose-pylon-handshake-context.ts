import { randomUUID } from "crypto";
import type {
  IoServer,
  PylonSocket,
  PylonSocketData,
  PylonSocketHandshakeContextBase,
} from "../../../types/index.js";

export const composePylonHandshakeContext = <D extends PylonSocketData = PylonSocketData>(
  io: IoServer,
  socket: PylonSocket<D>,
): PylonSocketHandshakeContextBase<D> => {
  return {
    handshakeId: randomUUID(),
    io: { app: io, socket },
  };
};
