import { LindormTokenTypes } from "@lindorm-io/common-types";
import { configuration } from "../server/configuration";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";

export const authenticationConfirmationTokenMiddleware = tokenValidationMiddleware({
  contextKey: "authenticationConfirmationToken",
  issuer: configuration.services.authentication_service.issuer,
  types: [LindormTokenTypes.AUTHENTICATION_CONFIRMATION],
});

export const idTokenMiddleware = tokenValidationMiddleware({
  contextKey: "idToken",
  issuer: configuration.server.issuer,
  types: [LindormTokenTypes.ID],
});

export const refreshTokenMiddleware = tokenValidationMiddleware({
  contextKey: "refreshToken",
  issuer: configuration.server.issuer,
  types: [LindormTokenTypes.REFRESH],
});
