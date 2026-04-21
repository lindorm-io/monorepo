import type { IoServer, PylonHttpMiddleware } from "../../types/index.js";

export const httpSocketIoMiddleware = (io: IoServer): PylonHttpMiddleware =>
  async function httpSocketIoMiddleware(ctx, next) {
    ctx.io = { app: io };

    await next();
  };
