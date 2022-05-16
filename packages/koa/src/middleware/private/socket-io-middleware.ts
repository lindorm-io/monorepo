import { DefaultLindormMiddleware, IOServer } from "../../types";

export const socketIoMiddleware =
  (io: IOServer): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    ctx.connection.io = io;
    await next();
  };
