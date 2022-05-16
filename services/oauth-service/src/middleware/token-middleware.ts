import { TokenType } from "../enum";
import { configuration } from "../server/configuration";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";

export const idTokenMiddleware = tokenValidationMiddleware({
  contextKey: "idToken",
  issuer: configuration.server.issuer || configuration.server.host,
  types: [TokenType.IDENTITY],
});

export const refreshTokenMiddleware = tokenValidationMiddleware({
  contextKey: "refreshToken",
  issuer: configuration.server.issuer || configuration.server.host,
  types: [TokenType.REFRESH],
});
