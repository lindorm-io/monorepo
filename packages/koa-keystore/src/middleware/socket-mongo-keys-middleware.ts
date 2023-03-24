import { DefaultLindormKeystoreSocketMiddleware } from "../types";
import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";
import { getKeysFromMongo } from "../util";

export const socketMongoKeysMiddleware: DefaultLindormKeystoreSocketMiddleware =
  promisifyLindormSocketMiddleware(async (socket) => {
    socket.ctx.keys = await getKeysFromMongo(socket.ctx);
  });
