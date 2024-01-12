import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";
import { DefaultLindormKeystoreSocketMiddleware } from "../types";
import { getKeysFromRedis } from "../utils";

export const socketRedisKeysMiddleware: DefaultLindormKeystoreSocketMiddleware =
  promisifyLindormSocketMiddleware(async (socket) => {
    const keys = await getKeysFromRedis(socket.ctx);

    socket.ctx.keys = [socket.ctx.keys, keys].flat();
  });
