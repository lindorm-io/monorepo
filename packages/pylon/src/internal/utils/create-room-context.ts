import { expiresAt } from "@lindorm/date";
import type { ILogger } from "@lindorm/logger";
import type { IProteusRepository, IProteusSource } from "@lindorm/proteus";
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

const createPresenceRepoFactory = (
  proteusSource: IProteusSource,
  logger: ILogger,
): (() => Promise<IProteusRepository<any>>) => {
  let cached: IProteusRepository<any> | undefined;
  return async () => {
    if (!cached) {
      const { Presence } = await import("../../entities/Presence.js");
      cached = proteusSource.session({ logger }).repository(Presence);
    }
    return cached;
  };
};

export const createHttpRoomContext = (
  options: CreateHttpRoomContextOptions,
): PylonRoomContextHttp => {
  const { io, logger, proteusSource, presence } = options;

  const getPresenceRepo =
    presence && proteusSource ? createPresenceRepoFactory(proteusSource, logger) : null;

  return {
    members: async (room: string): Promise<Array<string>> => {
      const sockets = await io.in(room).fetchSockets();
      return sockets.map((s) => s.id);
    },

    ...(getPresenceRepo
      ? {
          presence: async (
            room: string,
          ): Promise<Array<{ userId: string; socketId: string; joinedAt: Date }>> => {
            const presenceRepo = await getPresenceRepo();
            const records = await presenceRepo.find({ room });
            return records.map((r: any) => ({
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

  const getPresenceRepo =
    presence && proteusSource ? createPresenceRepoFactory(proteusSource, logger) : null;

  const userId = (socket.data as any)?.tokens?.accessToken?.payload?.subject ?? socket.id;

  return {
    join: async (room: string): Promise<void> => {
      await socket.join(room);
      logger.debug("Joined room", { room, socketId: socket.id });

      if (getPresenceRepo) {
        const presenceRepo = await getPresenceRepo();
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

      if (getPresenceRepo) {
        const presenceRepo = await getPresenceRepo();
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

    ...(getPresenceRepo
      ? {
          presence: async (
            room: string,
          ): Promise<Array<{ userId: string; socketId: string; joinedAt: Date }>> => {
            const presenceRepo = await getPresenceRepo();
            const records = await presenceRepo.find({ room });
            return records.map((r: any) => ({
              userId: r.userId,
              socketId: r.socketId,
              joinedAt: r.joinedAt,
            }));
          },
        }
      : {}),
  };
};
