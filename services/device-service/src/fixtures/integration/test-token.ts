import { configuration } from "../../server/configuration";
import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import { randomString } from "@lindorm-io/random";
import { ChallengeConfirmationTokenClaims } from "../../common";
import { randomUUID } from "crypto";
import {
  ChallengeStrategy,
  DeviceTokenType,
  PSD2Factor,
  SubjectHint,
} from "@lindorm-io/common-types";

export const getTestChallengeConfirmationToken = (
  options: Partial<JwtSignOptions<Record<string, unknown>, ChallengeConfirmationTokenClaims>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign<Record<string, unknown>, ChallengeConfirmationTokenClaims>({
    audiences: [configuration.oauth.client_id],
    claims: {
      deviceLinkId: "id",
      factors: [PSD2Factor.POSSESSION, PSD2Factor.KNOWLEDGE],
      strategy: ChallengeStrategy.PINCODE,
    },
    expiry: configuration.defaults.challenge_confirmation_token_expiry,
    nonce: randomString(16),
    payload: { generated: true },
    scopes: ["test"],
    session: randomUUID(),
    sessionHint: "challenge",
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: DeviceTokenType.CHALLENGE_CONFIRMATION,
    ...options,
  });
  return token;
};

export const getTestChallengeSessionToken = (
  options: Partial<JwtSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: [configuration.oauth.client_id],
    expiry: configuration.defaults.challenge_session_expiry,
    session: randomUUID(),
    sessionHint: "challenge",
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: DeviceTokenType.CHALLENGE_SESSION,
    ...options,
  });
  return token;
};

export const getTestEnrolmentSessionToken = (
  options: Partial<JwtSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: [configuration.oauth.client_id],
    expiry: configuration.defaults.enrolment_session_expiry,
    session: randomUUID(),
    sessionHint: "enrolment",
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: DeviceTokenType.ENROLMENT_SESSION,
    ...options,
  });
  return token;
};

export const getTestRdcToken = (options: Partial<JwtSignOptions<any, any>> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: [configuration.oauth.client_id],
    expiry: configuration.defaults.remote_device_challenge_session_expiry,
    session: randomUUID(),
    sessionHint: "rdc",
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: DeviceTokenType.REMOTE_DEVICE_CHALLENGE_SESSION,
    ...options,
  });
  return token;
};
