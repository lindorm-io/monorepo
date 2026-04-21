import type { PylonConnectionMiddleware } from "../../types/index.js";

export const connectionLoggerMiddleware: PylonConnectionMiddleware = async (
  ctx,
  next,
) => {
  const start = Date.now();

  ctx.logger?.info("Socket handshake received", {
    socketId: ctx.io.socket.id,
  });

  await next();

  ctx.logger?.info("Socket handshake resolved", {
    socketId: ctx.io.socket.id,
    time: Date.now() - start,
  });
};
