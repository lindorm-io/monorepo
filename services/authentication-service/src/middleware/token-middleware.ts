import { TokenType } from "../common";
import { configuration } from "../server/configuration";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";

export const authenticationConfirmationTokenMiddleware = tokenValidationMiddleware({
  contextKey: "authenticationConfirmationToken",
  issuer: configuration.server.issuer,
  types: [TokenType.AUTHENTICATION_CONFIRMATION],
});

export const strategySessionTokenMiddleware = tokenValidationMiddleware({
  contextKey: "strategySessionToken",
  issuer: configuration.server.issuer,
  types: [TokenType.STRATEGY_SESSION],
});
