import { DefaultLindormKeystoreSocketMiddleware } from "../types";
import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";
import { getKeysFromMemory } from "../util";

export const socketMemoryKeysMiddleware: DefaultLindormKeystoreSocketMiddleware =
  promisifyLindormSocketMiddleware(async (socket) => {
    socket.ctx.keys = await getKeysFromMemory(socket.ctx);
  });
