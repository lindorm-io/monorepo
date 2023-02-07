import { LindormTokenTypes } from "@lindorm-io/common-types";
import { configuration } from "../server/configuration";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";

export const authenticationConfirmationTokenMiddleware = tokenValidationMiddleware({
  contextKey: "authenticationConfirmationToken",
  issuer: configuration.server.issuer,
  types: [LindormTokenTypes.AUTHENTICATION_CONFIRMATION],
});

export const strategySessionTokenMiddleware = tokenValidationMiddleware({
  contextKey: "strategySessionToken",
  issuer: configuration.server.issuer,
  types: [LindormTokenTypes.STRATEGY_SESSION],
});
