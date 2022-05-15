import { DefaultLindormKeystoreSocketMiddleware } from "../types";
import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";
import { getKeysFromCache } from "../util";

export const socketCacheKeysMiddleware: DefaultLindormKeystoreSocketMiddleware =
  promisifyLindormSocketMiddleware(async (socket) => {
    socket.ctx.keys = await getKeysFromCache(socket.ctx);
  });
