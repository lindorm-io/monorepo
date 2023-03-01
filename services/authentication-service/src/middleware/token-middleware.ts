import { AuthenticationTokenType } from "@lindorm-io/common-types";
import { configuration } from "../server/configuration";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";

export const authenticationConfirmationTokenMiddleware = tokenValidationMiddleware({
  contextKey: "authenticationConfirmationToken",
  issuer: configuration.server.issuer,
  types: [AuthenticationTokenType.AUTHENTICATION_CONFIRMATION],
});

export const strategySessionTokenMiddleware = tokenValidationMiddleware({
  contextKey: "strategySessionToken",
  issuer: configuration.server.issuer,
  types: [AuthenticationTokenType.STRATEGY_SESSION],
});
