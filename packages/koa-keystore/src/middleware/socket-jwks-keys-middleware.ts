import { DefaultLindormKeystoreSocketMiddleware, JwksKeysMiddlewareConfig } from "../types";
import { getKeysFromJwks } from "../util";
import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";

export const socketJwksKeysMiddleware = (
  config: JwksKeysMiddlewareConfig,
): DefaultLindormKeystoreSocketMiddleware =>
  promisifyLindormSocketMiddleware(async (socket) => {
    socket.ctx.keys = await getKeysFromJwks(
      {
        host: config.host,
        port: config.port,
        alias: config.alias,
        client: config.client,
        currentKeys: socket.ctx.keys,
        path: config.path,
      },
      socket.ctx.logger,
    );
  });
