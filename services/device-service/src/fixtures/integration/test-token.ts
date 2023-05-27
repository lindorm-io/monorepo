import { configuration } from "../../server/configuration";
import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import { randomHex } from "@lindorm-io/random";
import { ChallengeConfirmationTokenClaims, RdcSessionTokenClaims } from "../../common";
import { randomUUID } from "crypto";
import {
  ChallengeStrategy,
  DeviceTokenType,
  PSD2Factor,
  SubjectHint,
} from "@lindorm-io/common-types";

export const getTestChallengeConfirmationToken = (
  options: Partial<JwtSignOptions<ChallengeConfirmationTokenClaims>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign<ChallengeConfirmationTokenClaims>({
    audiences: [configuration.oauth.client_id],
    claims: {
      deviceLinkId: "id",
      ext: { generated: true },
      factors: [PSD2Factor.POSSESSION, PSD2Factor.KNOWLEDGE],
      strategy: ChallengeStrategy.PINCODE,
    },
    expiry: configuration.defaults.challenge_confirmation_token_expiry,
    nonce: randomHex(16),
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

export const getTestChallengeSessionToken = (options: Partial<JwtSignOptions> = {}): string => {
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

export const getTestEnrolmentSessionToken = (options: Partial<JwtSignOptions> = {}): string => {
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

export const getTestRdcToken = (
  options: Partial<JwtSignOptions<RdcSessionTokenClaims>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign<RdcSessionTokenClaims>({
    audiences: [configuration.oauth.client_id],
    claims: {
      ext: {},
    },
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
