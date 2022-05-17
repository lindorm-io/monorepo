import { DefaultLindormJwtSocketMiddleware } from "../types";
import { getTokenIssuer } from "../util";
import { getSocketError } from "@lindorm-io/koa";

interface Options {
  issuer: string;
}

export const socketTokenIssuerMiddleware =
  (options: Options): DefaultLindormJwtSocketMiddleware =>
  (socket, next) => {
    try {
      socket.ctx.jwt = getTokenIssuer(socket.ctx, options.issuer);
      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
