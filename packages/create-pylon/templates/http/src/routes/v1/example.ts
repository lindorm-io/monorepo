import { useHandler, useSchema } from "@lindorm/pylon";
import type { ServerHttpMiddleware } from "../../types/context";
import { exampleHandler, exampleSchema } from "../../handlers/example-handler";

export const GET: Array<ServerHttpMiddleware> = [
  useSchema(exampleSchema),
  useHandler(exampleHandler),
];
