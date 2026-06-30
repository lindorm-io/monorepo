import { NotFoundError } from "@lindorm/errors";
import { z } from "zod";
import type { ServerHandler } from "../../types/context.js";

export const exampleSchema = z.object({
  name: z.string().optional(),
});

// Stand-in for a real lookup (database, cache, upstream service).
const GREETINGS: Record<string, string> = {
  world: "Hello, world!",
  pylon: "Hello, Pylon!",
};

export const exampleHandler: ServerHandler<typeof exampleSchema> = async (ctx) => {
  const name = ctx.data.name ?? "world";
  const message = GREETINGS[name];

  // Raise errors with @lindorm/errors — not koa's `ctx.throw`. The Pylon HTTP
  // error handler turns a thrown error into a structured JSON response with the
  // matching status (404 here); `code` and `data` surface in the response body.
  if (!message) {
    throw new NotFoundError(`No greeting for "${name}"`, {
      code: "greeting_not_found",
      data: { name },
    });
  }

  return { body: { message } };
};
