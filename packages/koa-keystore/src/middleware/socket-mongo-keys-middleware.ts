import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";
import { DefaultLindormKeystoreSocketMiddleware } from "../types";
import { getKeysFromMongo } from "../utils";

export const socketMongoKeysMiddleware: DefaultLindormKeystoreSocketMiddleware =
  promisifyLindormSocketMiddleware(async (socket) => {
    const keys = await getKeysFromMongo(socket.ctx);

    socket.ctx.keys = [socket.ctx.keys, keys].flat();
  });
