import { DefaultLindormJwtSocketMiddleware } from "../types";
import { getTokenIssuer } from "../util";

interface Options {
  issuer: string;
}

export const socketTokenIssuerMiddleware =
  (options: Options): DefaultLindormJwtSocketMiddleware =>
  (socket, next) => {
    socket.ctx.jwt = getTokenIssuer(socket.ctx, options.issuer);

    next();
  };
