import { TokenType } from "@lindorm-io/common-enums";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";
import { configuration } from "../server/configuration";

export const authenticationConfirmationTokenMiddleware = tokenValidationMiddleware({
  contextKey: "authenticationConfirmationToken",
  issuer: configuration.server.issuer,
  types: [TokenType.AUTHENTICATION_CONFIRMATION],
});

export const strategySessionTokenMiddleware = tokenValidationMiddleware({
  contextKey: "strategySessionToken",
  issuer: configuration.server.issuer,
  types: [TokenType.STRATEGY],
});
