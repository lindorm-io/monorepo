import { DefaultLindormKeystoreSocketMiddleware } from "../types";
import { Keystore } from "@lindorm-io/key-pair";
import { getSocketError } from "@lindorm-io/koa";

export const socketKeystoreMiddleware: DefaultLindormKeystoreSocketMiddleware = (socket, next) => {
  try {
    socket.ctx.keystore = new Keystore({ keys: socket.ctx.keys });
    socket.ctx.logger.debug("keystore initialised", { amount: socket.ctx.keys.length });
    next();
  } catch (err: any) {
    next(getSocketError(socket, err));
  }
};
