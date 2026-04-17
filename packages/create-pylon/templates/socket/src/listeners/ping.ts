import { useSchema } from "@lindorm/pylon";
import type { ServerSocketMiddleware } from "../types/context";
import { pingHandler, pingSchema } from "../handlers/ping-handler";

export const ON: Array<ServerSocketMiddleware> = [useSchema(pingSchema), pingHandler];
