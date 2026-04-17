import type { ServerSocketMiddleware } from "../types/context";

export const exampleMiddleware: ServerSocketMiddleware = async (ctx, next) => {
  ctx.logger.warn(
    "This is already logged but as an example we'll do it again as a warn",
    {
      event: ctx.event,
      eventId: ctx.eventId,
      socketId: ctx.io.socket.id,
    },
  );

  await next();
};
