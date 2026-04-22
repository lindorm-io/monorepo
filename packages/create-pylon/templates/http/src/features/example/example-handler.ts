import { z } from "zod";
import type { ServerHandler } from "../../types/context.js";

export const exampleSchema = z.object({
  name: z.string().optional(),
});

export const exampleHandler: ServerHandler<typeof exampleSchema> = async (ctx) => {
  const name = ctx.data.name ?? "world";
  return { body: { message: `Hello, ${name}!` } };
};
