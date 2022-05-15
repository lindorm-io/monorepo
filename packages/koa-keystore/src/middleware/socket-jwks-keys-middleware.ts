import { DefaultLindormKeystoreSocketMiddleware, JwksKeysMiddlewareConfig } from "../types";
import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";
import { getKeysFromJwks } from "../util";

export const socketJwksKeysMiddleware = (
  config: JwksKeysMiddlewareConfig,
): DefaultLindormKeystoreSocketMiddleware =>
  promisifyLindormSocketMiddleware(async (socket) => {
    socket.ctx.keys = await getKeysFromJwks(socket.ctx, config);
  });
