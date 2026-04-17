import { z } from "zod";
import type { ServerSocketHandler } from "../types/context";

export const pingSchema = z.object({
  message: z.string().optional(),
});

export const pingHandler: ServerSocketHandler<typeof pingSchema> = async (ctx) => {
  ctx.logger.info("Received ping", { data: ctx.data });

  ctx.ack?.({
    pong: true,
    message: ctx.data.message,
    receivedAt: new Date().toISOString(),
  });
};
