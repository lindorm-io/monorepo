import { TokenType } from "../common";
import { configuration } from "../server/configuration";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";

export const idTokenMiddleware = tokenValidationMiddleware({
  contextKey: "idToken",
  issuer: configuration.server.issuer,
  types: [TokenType.IDENTITY],
});

export const refreshTokenMiddleware = tokenValidationMiddleware({
  contextKey: "refreshToken",
  issuer: configuration.server.issuer,
  types: [TokenType.REFRESH],
});
