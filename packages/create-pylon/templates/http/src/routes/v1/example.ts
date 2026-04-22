import { useHandler, useSchema } from "@lindorm/pylon";
import type { ServerHttpMiddleware } from "../../types/context.js";
import { exampleHandler, exampleSchema } from "../../handlers/example-handler.js";

export const GET: Array<ServerHttpMiddleware> = [
  useSchema(exampleSchema),
  useHandler(exampleHandler),
];
