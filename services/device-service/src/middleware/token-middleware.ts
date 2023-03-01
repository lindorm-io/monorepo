import { configuration } from "../server/configuration";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";
import { DeviceTokenType } from "@lindorm-io/common-types";

export const challengeConfirmationTokenMiddleware = tokenValidationMiddleware({
  contextKey: "challengeConfirmationToken",
  issuer: configuration.server.issuer,
  types: [DeviceTokenType.CHALLENGE_CONFIRMATION],
});

export const challengeSessionTokenMiddleware = tokenValidationMiddleware({
  contextKey: "challengeSessionToken",
  issuer: configuration.server.issuer,
  types: [DeviceTokenType.CHALLENGE_SESSION],
});

export const enrolmentSessionTokenMiddleware = tokenValidationMiddleware({
  contextKey: "enrolmentSessionToken",
  issuer: configuration.server.issuer,
  types: [DeviceTokenType.ENROLMENT_SESSION],
});

export const rdcSessionTokenMiddleware = tokenValidationMiddleware({
  contextKey: "rdcSessionToken",
  issuer: configuration.server.issuer,
  types: [DeviceTokenType.REMOTE_DEVICE_CHALLENGE_SESSION],
});
