import { DefaultLindormBearerAuthSocketMiddleware, BearerAuthMiddlewareConfig } from "../types";
import { ClientError } from "@lindorm-io/errors";
import { getSocketError } from "@lindorm-io/koa";

export const socketBearerAuthMiddleware =
  (config: BearerAuthMiddlewareConfig): DefaultLindormBearerAuthSocketMiddleware =>
  (socket, next) => {
    try {
      const {
        clockTolerance,
        contextKey = "bearerToken",
        issuer,
        maxAge,
        subjectHint,
        types,
      } = config;

      const token = socket.handshake.auth[contextKey];

      if (!token) {
        throw new ClientError("Invalid Authorization", {
          debug: { auth: socket.handshake.auth },
          description: "Token not found",
        });
      }

      try {
        const verified = socket.ctx.jwt.verify(token, {
          clockTolerance,
          issuer,
          maxAge,
          subjectHint,
          types: types || ["access_token"],
        });

        socket.ctx.token[contextKey] = verified;

        socket.join([verified.subject, verified.sessionId]);
      } catch (err: any) {
        throw new ClientError("Invalid Authorization", {
          error: err,
          debug: { config },
          description: "Bearer Token is invalid",
        });
      }

      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
