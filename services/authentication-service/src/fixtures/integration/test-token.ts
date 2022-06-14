import { configuration } from "../../server/configuration";
import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import { getRandomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import {
  ClientPermission,
  ClientScope,
  IdentityPermission,
  Scope,
  SubjectHint,
  TokenType,
} from "../../common";

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
    type: TokenType.ACCESS,
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
    type: TokenType.ACCESS,
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
    audiences: [configuration.oauth.client_id],
    claims: {
      deviceLinkId: randomUUID(),
      factors: ["possession", "inherence"],
      strategy: "biometry",
    },
    expiry: "10 seconds",
    nonce: getRandomString(16),
    payload: {},
    scopes: ["authentication"],
    sessionId: randomUUID(),
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE_CONFIRMATION,
    ...options,
  });
  return token;
};

export const getTestAuthenticationConfirmationToken = (
  options: Partial<JwtSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: [configuration.oauth.client_id],
    authContextClass: ["loa_3"],
    authMethodsReference: ["device_challenge"],
    claims: {
      country: "se",
      remember: true,
    },
    expiry: "60 seconds",
    levelOfAssurance: 3,
    nonce: getRandomString(16),
    scopes: ["authentication"],
    sessionId: randomUUID(),
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.AUTHENTICATION_CONFIRMATION,
    ...options,
  });
  return token;
};

export const getTestStrategySessionToken = (
  options: Partial<JwtSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: [configuration.oauth.client_id],
    expiry: "10 seconds",
    subject: randomUUID(),
    subjectHint: SubjectHint.SESSION,
    type: TokenType.STRATEGY_SESSION,
    ...options,
  });
  return token;
};
