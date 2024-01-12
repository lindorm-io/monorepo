import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";
import { DefaultLindormKeystoreSocketMiddleware } from "../types";
import { getKeysFromMemory } from "../utils";

export const socketMemoryKeysMiddleware: DefaultLindormKeystoreSocketMiddleware =
  promisifyLindormSocketMiddleware(async (socket) => {
    const keys = await getKeysFromMemory(socket.ctx);

    socket.ctx.keys = [socket.ctx.keys, keys].flat();
  });
