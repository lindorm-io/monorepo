import { configuration } from "../../server/configuration";
import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import { getRandomString } from "@lindorm-io/core";
import {
  ChallengeConfirmationTokenClaims,
  ChallengeStrategy,
  ClientPermission,
  ClientScope,
  DeviceFactor,
  IdentityPermission,
  SubjectHint,
  TokenType,
} from "../../common";

export const getTestAccessToken = (options: Partial<JwtSignOptions<any, any>> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.oauth_service.issuer,
  }).sign({
    id: "a7534836-65f2-4e04-9f16-b5afebdcdd71",
    audiences: ["0438487d-0cf0-4399-b3d3-c2876db14ca6"],
    authMethodsReference: ["email"],
    expiry: "10 seconds",
    permissions: [IdentityPermission.USER],
    scopes: ["test"],
    subject: "subject",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ACCESS,
    ...options,
  });
  return token;
};

export const getTestClientCredentials = (
  options: Partial<JwtSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.oauth_service.issuer,
  }).sign({
    audiences: ["08e99132-09d5-4f87-a489-a62d2896a7bf"],
    expiry: "10 seconds",
    permissions: [ClientPermission.DEVICE_CONFIDENTIAL, ClientPermission.IDENTITY_CONFIDENTIAL],
    scopes: [
      ClientScope.DEVICE_IDENTITY_READ,
      ClientScope.DEVICE_RDC_READ,
      ClientScope.DEVICE_RDC_WRITE,
    ],
    subject: "08e99132-09d5-4f87-a489-a62d2896a7bf",
    subjectHint: SubjectHint.CLIENT,
    type: TokenType.ACCESS,
    ...options,
  });
  return token;
};

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
    nonce: getRandomString(16),
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
