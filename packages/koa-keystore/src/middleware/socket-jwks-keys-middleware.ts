import { DefaultLindormKeystoreSocketMiddleware, JwksKeysMiddlewareConfig } from "../types";
import { getKeysFromJwks } from "../util";
import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";

export const socketJwksKeysMiddleware = (
  config: JwksKeysMiddlewareConfig,
): DefaultLindormKeystoreSocketMiddleware =>
  promisifyLindormSocketMiddleware(async (socket) => {
    socket.ctx.keys = await getKeysFromJwks({
      currentKeys: socket.ctx.keys,
      host: config.host,
      logger: socket.ctx.logger,
      name: config.name,
      path: config.path,
      port: config.port,
    });
  });
