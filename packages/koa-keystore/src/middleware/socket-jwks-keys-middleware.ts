import { promisifyLindormSocketMiddleware } from "@lindorm-io/koa";
import { DefaultLindormKeystoreSocketMiddleware, JwksKeysMiddlewareConfig } from "../types";
import { getKeysFromJwks } from "../utils";

export const socketJwksKeysMiddleware = (
  config: JwksKeysMiddlewareConfig,
): DefaultLindormKeystoreSocketMiddleware =>
  promisifyLindormSocketMiddleware(async (socket) => {
    const keys = await getKeysFromJwks(
      {
        host: config.host,
        port: config.port,
        alias: config.alias,
        client: config.client,
        path: config.path,
      },
      socket.ctx.logger,
    );

    socket.ctx.keys = [socket.ctx.keys, keys].flat();
  });
