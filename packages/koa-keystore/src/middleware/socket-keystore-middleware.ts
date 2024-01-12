import { Keystore } from "@lindorm-io/keystore";
import { getSocketError } from "@lindorm-io/koa";
import { DefaultLindormKeystoreSocketMiddleware } from "../types";

export const socketKeystoreMiddleware: DefaultLindormKeystoreSocketMiddleware = (socket, next) => {
  try {
    socket.ctx.keystore = new Keystore(socket.ctx.keys, socket.ctx.logger);
    socket.ctx.logger.debug("keystore initialised", { amount: socket.ctx.keystore.allKeys.length });
    next();
  } catch (err: any) {
    next(getSocketError(socket, err));
  }
};
