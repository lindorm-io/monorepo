import { TokenType } from "../enum";
import { configuration } from "../configuration";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";

export const idTokenMiddleware = tokenValidationMiddleware({
  contextKey: "idToken",
  issuer: configuration.server.host,
  types: [TokenType.IDENTITY],
});

export const refreshTokenMiddleware = tokenValidationMiddleware({
  contextKey: "refreshToken",
  issuer: configuration.server.host,
  types: [TokenType.REFRESH],
});
