import { DefaultLindormKeystoreSocketMiddleware } from "../types";
import { Keystore } from "@lindorm-io/key-pair";

export const socketKeystoreMiddleware: DefaultLindormKeystoreSocketMiddleware = (socket, next) => {
  socket.ctx.keystore = new Keystore({ keys: socket.ctx.keys });

  socket.ctx.logger.debug("keystore initialised", { amount: socket.ctx.keys.length });

  next();
};
