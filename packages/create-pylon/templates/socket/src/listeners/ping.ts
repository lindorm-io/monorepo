import { useSchema } from "@lindorm/pylon";
import type { ServerSocketMiddleware } from "../types/context.js";
import { pingHandler, pingSchema } from "../features/ping/ping-handler.js";

export const ON: Array<ServerSocketMiddleware> = [useSchema(pingSchema), pingHandler];
