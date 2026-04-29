import { expiresAt } from "@lindorm/date";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSource } from "@lindorm/proteus";
import { Presence } from "../../entities/index.js";
import type { PylonRoomContextHttp, PylonRoomContextSocket } from "../../types/index.js";
import type { PylonSocket } from "../../types/pylon-socket.js";
import type { IoServer } from "../../types/socket.js";

type CreateRoomContextOptions = {
  socket: PylonSocket;
  io: IoServer;
  logger: ILogger;
  proteusSource?: IProteusSource;
  presence?: boolean;
};

type CreateHttpRoomContextOptions = {
  io: IoServer;
  logger: ILogger;
  proteusSource?: IProteusSource;
  presence?: boolean;
};

export const createHttpRoomContext = (
  options: CreateHttpRoomContextOptions,
): PylonRoomContextHttp => {
  const { io, logger, proteusSource, presence } = options;

  const presenceRepo =
    presence && proteusSource
      ? proteusSource.session({ logger }).repository(Presence)
      : null;

  return {
    members: async (room: string): Promise<Array<string>> => {
      const sockets = await io.in(room).fetchSockets();
      return sockets.map((s) => s.id);
    },

    ...(presenceRepo
      ? {
          presence: async (
            room: string,
          ): Promise<Array<{ userId: string; socketId: string; joinedAt: Date }>> => {
            const records = await presenceRepo.find({ room });
            return records.map((r) => ({
              userId: r.userId,
              socketId: r.socketId,
              joinedAt: r.joinedAt,
            }));
          },
        }
      : {}),
  };
};

export const createRoomContext = (
  options: CreateRoomContextOptions,
): PylonRoomContextSocket => {
  const { socket, io, logger, proteusSource, presence } = options;

  const presenceRepo =
    presence && proteusSource
      ? proteusSource.session({ logger }).repository(Presence)
      : null;

  const userId = (socket.data as any)?.tokens?.accessToken?.payload?.subject ?? socket.id;

  return {
    join: async (room: string): Promise<void> => {
      await socket.join(room);
      logger.debug("Joined room", { room, socketId: socket.id });

      if (presenceRepo) {
        const id = `${room}:${socket.id}`;
        await presenceRepo.findOneOrSave(
          { id },
          {
            id,
            room,
            socketId: socket.id,
            userId,
            joinedAt: new Date(),
            expiresAt: expiresAt("24 hours"),
          },
        );
      }
    },

    leave: async (room: string): Promise<void> => {
      await socket.leave(room);
      logger.debug("Left room", { room, socketId: socket.id });

      if (presenceRepo) {
        const id = `${room}:${socket.id}`;
        const existing = await presenceRepo.findOne({ id });
        if (existing) {
          await presenceRepo.destroy(existing);
        }
      }
    },

    members: async (room: string): Promise<Array<string>> => {
      const sockets = await io.in(room).fetchSockets();
      return sockets.map((s) => s.id);
    },

    ...(presenceRepo
      ? {
          presence: async (
            room: string,
          ): Promise<Array<{ userId: string; socketId: string; joinedAt: Date }>> => {
            const records = await presenceRepo.find({ room });
            return records.map((r) => ({
              userId: r.userId,
              socketId: r.socketId,
              joinedAt: r.joinedAt,
            }));
          },
        }
      : {}),
  };
};
