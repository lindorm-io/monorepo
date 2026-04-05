import { ServerError } from "@lindorm/errors";
import { IProteusSource } from "@lindorm/proteus";
import { ROOMS_SOURCE } from "#internal/constants/symbols";
import { isSocketContext } from "#internal/utils/is-context";
import { Presence } from "../../entities";
import { PylonContext, PylonMiddleware } from "../../types";

type UseRoomsOptions = {
  presence?: boolean;
};

const PRESENCE_TTL_MS = 24 * 60 * 60 * 1000;

export const useRooms = (options: UseRoomsOptions = {}): PylonMiddleware => {
  return async function useRoomsMiddleware(ctx: PylonContext, next) {
    if (!isSocketContext(ctx)) {
      throw new ServerError("useRooms middleware is only available on socket contexts");
    }

    const presenceRepo = options.presence
      ? (() => {
          const rawSource = (ctx as any)[ROOMS_SOURCE] as IProteusSource | undefined;
          if (!rawSource) {
            throw new ServerError(
              "Rooms presence requires rooms.proteus in PylonOptions or a default proteus source",
            );
          }
          return rawSource.session({ logger: ctx.logger }).repository(Presence);
        })()
      : null;

    const userId =
      (ctx.state?.tokens?.accessToken as any)?.payload?.subject ?? ctx.socket.id;

    ctx.rooms = {
      join: async (room: string) => {
        await ctx.socket.join(room);
        ctx.logger.debug("Joined room", { room, socketId: ctx.socket.id });

        if (presenceRepo) {
          const id = `${room}:${ctx.socket.id}`;
          await presenceRepo.findOneOrSave(
            { id },
            {
              id,
              room,
              socketId: ctx.socket.id,
              userId,
              joinedAt: new Date(),
              expiresAt: new Date(Date.now() + PRESENCE_TTL_MS),
            },
          );
        }
      },

      leave: async (room: string) => {
        await ctx.socket.leave(room);
        ctx.logger.debug("Left room", { room, socketId: ctx.socket.id });

        if (presenceRepo) {
          const id = `${room}:${ctx.socket.id}`;
          const existing = await presenceRepo.findOne({ id });
          if (existing) {
            await presenceRepo.destroy(existing);
          }
        }
      },

      broadcast: (room: string, event: string, data?: any) => {
        ctx.socket.to(room).emit(event, data);
      },

      emit: (room: string, event: string, data?: any) => {
        ctx.io.to(room).emit(event, data);
      },

      members: async (room: string) => {
        const sockets = await ctx.io.in(room).fetchSockets();
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

    await next();
  };
};
