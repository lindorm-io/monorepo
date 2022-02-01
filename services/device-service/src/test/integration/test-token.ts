import { ChallengeStrategy, Factor, TokenType } from "../../enum";
import { IssuerSignOptions } from "@lindorm-io/jwt";
import { configuration } from "../../configuration";
import { getRandomString } from "@lindorm-io/core";
import { getTestDeviceLinkJwt, getTestJwt } from "./test-jwt";
import { ClientPermission, ClientScope, IdentityPermission, SubjectHint } from "../../common";
import { ChallengeConfirmationTokenClaims } from "../../types";

export const getTestAccessToken = (options: Partial<IssuerSignOptions<any, any>> = {}): string => {
  const { token } = getTestJwt().sign({
    id: "a7534836-65f2-4e04-9f16-b5afebdcdd71",
    audiences: ["0438487d-0cf0-4399-b3d3-c2876db14ca6"],
    authMethodsReference: ["email"],
    expiry: "10 seconds",
    permissions: [IdentityPermission.USER],
    scopes: ["test"],
    subject: "subject",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ACCESS_TOKEN,
    ...options,
  });

  return token;
};

export const getTestClientCredentials = (
  options: Partial<IssuerSignOptions<any, any>> = {},
): string => {
  const { token } = getTestJwt().sign({
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
    type: TokenType.ACCESS_TOKEN,
    ...options,
  });

  return token;
};

export const getTestChallengeConfirmationToken = (
  options: Partial<
    IssuerSignOptions<Record<string, unknown>, ChallengeConfirmationTokenClaims>
  > = {},
): string => {
  const { token } = getTestDeviceLinkJwt().sign<
    Record<string, unknown>,
    ChallengeConfirmationTokenClaims
  >({
    audiences: ["a3a90c66-c7b6-4ffe-ba04-c1f9de429f04"],
    claims: {
      deviceLinkId: "id",
      factors: [Factor.POSSESSION, Factor.KNOWLEDGE],
      strategy: ChallengeStrategy.PINCODE,
    },
    expiry: configuration.expiry.challenge_confirmation_token,
    nonce: getRandomString(16),
    payload: { generated: true },
    scopes: ["test"],
    sessionId: "id",
    subject: "subject",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE_CONFIRMATION_TOKEN,
    ...options,
  });

  return token;
};

export const getTestChallengeSessionToken = (
  options: Partial<IssuerSignOptions<any, any>> = {},
): string => {
  const { token } = getTestDeviceLinkJwt().sign({
    audiences: ["a3a90c66-c7b6-4ffe-ba04-c1f9de429f04"],
    expiry: configuration.expiry.challenge_session,
    sessionId: "id",
    subject: "subject",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE_SESSION_TOKEN,
    ...options,
  });

  return token;
};

export const getTestEnrolmentSessionToken = (
  options: Partial<IssuerSignOptions<any, any>> = {},
): string => {
  const { token } = getTestDeviceLinkJwt().sign({
    audiences: ["a3a90c66-c7b6-4ffe-ba04-c1f9de429f04"],
    expiry: configuration.expiry.enrolment_session,
    sessionId: "id",
    subject: "subject",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ENROLMENT_SESSION_TOKEN,
    ...options,
  });

  return token;
};

export const getTestEdsToken = (options: Partial<IssuerSignOptions<any, any>> = {}): string => {
  const { token } = getTestDeviceLinkJwt().sign({
    audiences: ["a3a90c66-c7b6-4ffe-ba04-c1f9de429f04"],
    expiry: configuration.expiry.remote_device_challenge_session,
    sessionId: "id",
    subject: "subject",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.REMOTE_DEVICE_CHALLENGE_SESSION_TOKEN,
    ...options,
  });

  return token;
};
