import { TokenType } from "../../enum";
import { configuration } from "../../server/configuration";
import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import {
  ClientPermission,
  ClientScope,
  IdentityPermission,
  Scope,
  SubjectHint,
} from "../../common";
import { randomUUID } from "crypto";
import { getRandomString } from "@lindorm-io/core";

export const getTestAccessToken = (options: Partial<JwtSignOptions<any, any>> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.oauth_service.issuer,
  }).sign({
    adjustedAccessLevel: 4,
    audiences: [randomUUID()],
    authMethodsReference: ["email"],
    expiry: "10 seconds",
    permissions: [IdentityPermission.USER],
    scopes: Object.values(Scope),
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: "access_token",
    ...options,
  });
  return `Bearer ${token}`;
};

export const getTestClientCredentials = (
  options: Partial<JwtSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.oauth_service.issuer,
  }).sign({
    audiences: [randomUUID()],
    expiry: "10 seconds",
    permissions: Object.values(ClientPermission),
    scopes: Object.values(ClientScope),
    subject: "08e99132-09d5-4f87-a489-a62d2896a7bf",
    subjectHint: SubjectHint.CLIENT,
    type: "access_token",
    ...options,
  });
  return `Bearer ${token}`;
};

export const getTestChallengeConfirmationToken = (
  options: Partial<JwtSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.device_service.issuer,
  }).sign({
    audiences: [randomUUID()],
    claims: {
      deviceLinkId: randomUUID(),
      factors: ["possession", "inherence"],
      strategy: "biometry",
    },
    expiry: new Date("2022-01-01T08:00:00.000Z"),
    nonce: getRandomString(16),
    payload: {},
    scopes: ["authentication"],
    sessionId: randomUUID(),
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE_CONFIRMATION_TOKEN,
    ...options,
  });
  return token;
};

export const getTestFlowSessionToken = (
  options: Partial<JwtSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: [configuration.oauth.client_id],
    expiry: new Date("2022-01-01T08:00:00.000Z"),
    sessionId: randomUUID(),
    subject: randomUUID(),
    subjectHint: SubjectHint.SESSION,
    type: TokenType.FLOW_SESSION,
    ...options,
  });
  return token;
};
