import { SubjectHint, TokenType } from "../../common";
import { configuration } from "../../server/configuration";
import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import { randomString } from "@lindorm-io/random";
import { getUnixTime } from "date-fns";
import { randomUUID } from "crypto";

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
    nonce: randomString(16),
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
    authMethodsReference: ["email_otp", "device_challenge"],
    authTime: getUnixTime(new Date()),
    claims: {
      country: "se",
      remember: true,
      maximumLoa: 3,
      verifiedIdentifiers: ["test@lindorm.io"],
    },
    expiry: "60 seconds",
    levelOfAssurance: 3,
    nonce: randomString(16),
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
