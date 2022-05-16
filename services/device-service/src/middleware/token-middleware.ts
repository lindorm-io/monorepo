import { TokenType } from "../enum";
import { configuration } from "../server/configuration";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";

export const challengeConfirmationTokenMiddleware = tokenValidationMiddleware({
  contextKey: "challengeConfirmationToken",
  issuer: configuration.server.issuer,
  types: [TokenType.CHALLENGE_CONFIRMATION_TOKEN],
});

export const challengeSessionTokenMiddleware = tokenValidationMiddleware({
  contextKey: "challengeSessionToken",
  issuer: configuration.server.issuer,
  types: [TokenType.CHALLENGE_SESSION_TOKEN],
});

export const enrolmentSessionTokenMiddleware = tokenValidationMiddleware({
  contextKey: "enrolmentSessionToken",
  issuer: configuration.server.issuer,
  types: [TokenType.ENROLMENT_SESSION_TOKEN],
});

export const rdcSessionTokenMiddleware = tokenValidationMiddleware({
  contextKey: "rdcSessionToken",
  issuer: configuration.server.issuer,
  types: [TokenType.REMOTE_DEVICE_CHALLENGE_SESSION_TOKEN],
});
