import { DefaultLindormKeystoreSocketMiddleware } from "../types";
import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";
import { getKeysFromRepository } from "../util";

export const socketRepositoryKeysMiddleware: DefaultLindormKeystoreSocketMiddleware =
  promisifyLindormSocketMiddleware(async (socket) => {
    socket.ctx.keys = await getKeysFromRepository(socket.ctx);
  });
