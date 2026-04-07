import { ILogger } from "@lindorm/logger";
import { IProteusSource } from "@lindorm/proteus";
import { Presence } from "../../entities";
import { PylonRoomContext } from "../../types";
import { IoServer } from "../../types/socket";
import { PylonSocket } from "../../types/pylon-socket";

type CreateRoomContextOptions = {
  socket: PylonSocket;
  io: IoServer;
  logger: ILogger;
  proteusSource?: IProteusSource;
  presence?: boolean;
};

const PRESENCE_TTL_MS = 24 * 60 * 60 * 1000;

export const createRoomContext = (
  options: CreateRoomContextOptions,
): PylonRoomContext => {
  const { socket, io, logger, proteusSource, presence } = options;

  const presenceRepo =
    presence && proteusSource
      ? proteusSource.session({ logger }).repository(Presence)
      : null;

  const userId = (socket.data as any)?.tokens?.accessToken?.payload?.subject ?? socket.id;

  const roomContext: PylonRoomContext = {
    join: async (room: string) => {
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
            expiresAt: new Date(Date.now() + PRESENCE_TTL_MS),
          },
        );
      }
    },

    leave: async (room: string) => {
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

    broadcast: (room: string, event: string, data?: any) => {
      socket.to(room).emit(event, data);
    },

    emit: (room: string, event: string, data?: any) => {
      io.to(room).emit(event, data);
    },

    members: async (room: string) => {
      const sockets = await io.in(room).fetchSockets();
      return sockets.map((s) => s.id);
    },

    ...(presenceRepo
      ? {
          presence: async (room: string) => {
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

  return roomContext;
};
