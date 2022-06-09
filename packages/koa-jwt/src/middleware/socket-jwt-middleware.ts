import { DefaultLindormJwtSocketMiddleware } from "../types";
import { getJwt } from "../util";
import { getSocketError } from "@lindorm-io/koa";

interface Options {
  issuer: string;
}

export const socketJwtMiddleware =
  (options: Options): DefaultLindormJwtSocketMiddleware =>
  (socket, next) => {
    try {
      socket.ctx.jwt = getJwt(socket.ctx, options.issuer);
      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
