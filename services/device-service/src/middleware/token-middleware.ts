import { TokenType } from "@lindorm-io/common-enums";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";
import { configuration } from "../server/configuration";

export const challengeConfirmationTokenMiddleware = tokenValidationMiddleware({
  contextKey: "challengeConfirmationToken",
  issuer: configuration.server.issuer,
  types: [TokenType.CHALLENGE_CONFIRMATION],
});

export const challengeSessionTokenMiddleware = tokenValidationMiddleware({
  contextKey: "challengeSessionToken",
  issuer: configuration.server.issuer,
  types: [TokenType.CHALLENGE],
});

export const enrolmentSessionTokenMiddleware = tokenValidationMiddleware({
  contextKey: "enrolmentSessionToken",
  issuer: configuration.server.issuer,
  types: [TokenType.ENROLMENT],
});

export const rdcSessionTokenMiddleware = tokenValidationMiddleware({
  contextKey: "rdcSessionToken",
  issuer: configuration.server.issuer,
  types: [TokenType.REMOTE_DEVICE_CHALLENGE],
});
