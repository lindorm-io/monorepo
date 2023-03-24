import { DefaultLindormKeystoreSocketMiddleware } from "../types";
import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";
import { getKeysFromRedis } from "../util";

export const socketRedisKeysMiddleware: DefaultLindormKeystoreSocketMiddleware =
  promisifyLindormSocketMiddleware(async (socket) => {
    socket.ctx.keys = await getKeysFromRedis(socket.ctx);
  });
