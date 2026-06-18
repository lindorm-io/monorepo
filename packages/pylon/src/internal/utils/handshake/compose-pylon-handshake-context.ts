import { randomId } from "@lindorm/random";
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
    handshakeId: randomId({ namespace: "hsk", length: 16 }),
    io: { app: io, socket },
  };
};
