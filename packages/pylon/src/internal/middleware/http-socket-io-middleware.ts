import { IoServer, PylonHttpMiddleware } from "../../types";

export const httpSocketIoMiddleware = (io: IoServer): PylonHttpMiddleware =>
  async function httpSocketIoMiddleware(ctx, next) {
    ctx.io = io;

    await next();
  };
