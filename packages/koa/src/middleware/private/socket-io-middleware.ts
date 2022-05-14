import { Server } from "socket.io";
import { Middleware } from "../../types";

export const socketIoMiddleware =
  (io: Server): Middleware =>
  async (ctx, next): Promise<void> => {
    ctx.connection.io = io;
    await next();
  };
