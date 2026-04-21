import type {
  PylonSocketEmitter,
  PylonSocketEmitterWithBroadcast,
} from "../../types/index.js";
import type { IoServer } from "../../types/socket.js";
import type { PylonSocket } from "../../types/pylon-socket.js";
import { buildPylonEnvelope } from "./build-pylon-envelope.js";

type CreateHttpSocketEmitterOptions = {
  io: IoServer;
  correlationId: string;
};

export const createHttpSocketEmitter = (
  options: CreateHttpSocketEmitterOptions,
): PylonSocketEmitter => ({
  emit: (target: string, event: string, data?: unknown): void => {
    options.io.to(target).emit(
      event,
      buildPylonEnvelope({
        correlationId: options.correlationId,
        payload: data,
      }),
    );
  },
});

type CreateSocketEmitterOptions = {
  io: IoServer;
  socket: PylonSocket;
  correlationId: string;
};

export const createSocketEmitter = (
  options: CreateSocketEmitterOptions,
): PylonSocketEmitterWithBroadcast => ({
  emit: (target: string, event: string, data?: unknown): void => {
    options.io.to(target).emit(
      event,
      buildPylonEnvelope({
        correlationId: options.correlationId,
        payload: data,
      }),
    );
  },
  broadcast: (target: string, event: string, data?: unknown): void => {
    options.socket.to(target).emit(
      event,
      buildPylonEnvelope({
        correlationId: options.correlationId,
        payload: data,
      }),
    );
  },
});
