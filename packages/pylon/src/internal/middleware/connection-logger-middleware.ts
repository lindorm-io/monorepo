import type { PylonConnectionMiddleware } from "../../types/index.js";

export const connectionLoggerMiddleware: PylonConnectionMiddleware = async (
  ctx,
  next,
) => {
  const start = Date.now();

  ctx.logger?.debug("Socket handshake received", {
    socketId: ctx.io.socket.id,
  });

  await next();

  ctx.logger?.debug("Socket handshake resolved", {
    socketId: ctx.io.socket.id,
    time: Date.now() - start,
  });
};
