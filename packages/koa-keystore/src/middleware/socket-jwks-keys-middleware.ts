import { DefaultLindormKeystoreSocketMiddleware, JwksKeysMiddlewareConfig } from "../types";
import { getKeysFromJwks } from "../util";
import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";

export const socketJwksKeysMiddleware = (
  config: JwksKeysMiddlewareConfig,
): DefaultLindormKeystoreSocketMiddleware =>
  promisifyLindormSocketMiddleware(async (socket) => {
    socket.ctx.keys = await getKeysFromJwks({
      clientName: config.clientName,
      currentKeys: socket.ctx.keys,
      host: config.host,
      logger: socket.ctx.logger,
      path: config.path,
      port: config.port,
    });
  });
