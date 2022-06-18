import { configuration } from "../../server/configuration";
import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import { randomString } from "@lindorm-io/core";
import {
  ChallengeConfirmationTokenClaims,
  ChallengeStrategy,
  DeviceFactor,
  SubjectHint,
  TokenType,
} from "../../common";

export const getTestChallengeConfirmationToken = (
  options: Partial<JwtSignOptions<Record<string, unknown>, ChallengeConfirmationTokenClaims>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign<Record<string, unknown>, ChallengeConfirmationTokenClaims>({
    audiences: ["a3a90c66-c7b6-4ffe-ba04-c1f9de429f04"],
    claims: {
      deviceLinkId: "id",
      factors: [DeviceFactor.POSSESSION, DeviceFactor.KNOWLEDGE],
      strategy: ChallengeStrategy.PINCODE,
    },
    expiry: configuration.defaults.challenge_confirmation_token_expiry,
    nonce: randomString(16),
    payload: { generated: true },
    scopes: ["test"],
    sessionId: "id",
    subject: "subject",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE_CONFIRMATION,
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
    audiences: ["a3a90c66-c7b6-4ffe-ba04-c1f9de429f04"],
    expiry: configuration.defaults.challenge_session_expiry,
    sessionId: "id",
    subject: "subject",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE_SESSION,
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
    audiences: ["a3a90c66-c7b6-4ffe-ba04-c1f9de429f04"],
    expiry: configuration.defaults.enrolment_session_expiry,
    sessionId: "id",
    subject: "subject",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ENROLMENT_SESSION,
    ...options,
  });
  return token;
};

export const getTestRdcToken = (options: Partial<JwtSignOptions<any, any>> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: ["a3a90c66-c7b6-4ffe-ba04-c1f9de429f04"],
    expiry: configuration.defaults.remote_device_challenge_session_expiry,
    sessionId: "id",
    subject: "subject",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.REMOTE_DEVICE_CHALLENGE_SESSION,
    ...options,
  });
  return token;
};
