import type { Socket } from "socket.io-client";

export interface ZephyrAuthStrategy {
  prepareHandshake(socket: Socket): Promise<void>;
  refresh(socket: Socket): Promise<void>;
}
