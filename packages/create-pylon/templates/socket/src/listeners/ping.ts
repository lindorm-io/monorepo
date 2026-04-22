import { useSchema } from "@lindorm/pylon";
import type { ServerSocketMiddleware } from "../types/context.js";
import { pingHandler, pingSchema } from "../handlers/ping-handler.js";

export const ON: Array<ServerSocketMiddleware> = [useSchema(pingSchema), pingHandler];
