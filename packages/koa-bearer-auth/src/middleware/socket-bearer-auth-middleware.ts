import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { getSocketError } from "@lindorm-io/koa";
import { BearerAuthMiddlewareConfig, DefaultLindormBearerAuthSocketMiddleware } from "../types";

interface Config extends BearerAuthMiddlewareConfig {
  adjustedAccessLevel?: AdjustedAccessLevel;
  levelOfAssurance?: LevelOfAssurance;
  maxAge?: string;
}

export const socketBearerAuthMiddleware =
  (config: Config): DefaultLindormBearerAuthSocketMiddleware =>
  (socket, next) => {
    try {
      const {
        adjustedAccessLevel,
        clockTolerance,
        contextKey = "bearerToken",
        issuer,
        levelOfAssurance,
        maxAge,
        subjectHints,
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
          adjustedAccessLevel,
          clockTolerance,
          issuer,
          levelOfAssurance,
          maxAge,
          subjectHints,
          types: types || ["access_token"],
        });

        socket.ctx.token[contextKey] = verified;

        const array = verified.claims.session
          ? [verified.claims.subject, verified.claims.session]
          : [verified.claims.subject];

        socket.join(array);
      } catch (err: any) {
        throw new ClientError("Invalid Authorization", {
          error: err,
          debug: { config },
          description: "Bearer Token is invalid",
        });
      }

      next();
    } catch (err: any) {
      next(getSocketError(socket, err));
    }
  };
