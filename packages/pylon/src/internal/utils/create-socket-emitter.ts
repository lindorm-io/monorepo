import { PylonSocketEmitter, PylonSocketEmitterWithBroadcast } from "../../types";
import { IoServer } from "../../types/socket";
import { PylonSocket } from "../../types/pylon-socket";
import { buildPylonEnvelope } from "./build-pylon-envelope";

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
