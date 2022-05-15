import { Server } from "socket.io";
import { DefaultLindormMiddleware } from "../../types";

export const socketIoMiddleware =
  (io: Server): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    ctx.connection.io = io;
    await next();
  };
