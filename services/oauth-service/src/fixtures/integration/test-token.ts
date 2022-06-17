import { IdentityServiceClaims, Scope, SubjectHint, TokenType } from "../../common";
import { configuration } from "../../server/configuration";
import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import { getRandomString } from "@lindorm-io/core";
import { getUnixTime } from "date-fns";
import { randomUUID } from "crypto";

export const getTestIdToken = (
  options: Partial<JwtSignOptions<any, Partial<IdentityServiceClaims>>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: ["7c79844e-2006-4d7c-a49e-ece40225361c"],
    authContextClass: ["loa_3", "email_otp", "phone_otp"],
    authMethodsReference: ["email_otp", "phone_otp"],
    claims: {},
    expiry: "10 seconds",
    levelOfAssurance: 3,
    nonce: "IpoPcFc9nWdB4hfZ",
    scopes: Object.values(Scope),
    sessionId: "4ed34efe-21da-47d2-bf18-b2dc5311ba56",
    subject: "5f55fbe6-0dc7-4d6c-b93e-88ec580be22d",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.IDENTITY,
    ...options,
  });

  return token;
};

export const getTestRefreshToken = (options: Partial<JwtSignOptions<any, any>> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    id: "8543b130-1db1-4d9b-8d43-44687199e84f",
    audiences: ["d507c23e-7db1-44e0-b5a2-ee53bd9d8d09"],
    expiry: "10 seconds",
    sessionId: "13932ef4-1668-4ca7-ad3a-62f8a475378d",
    subject: "4634b8bf-a17e-4788-84d7-3054d2e522cb",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.REFRESH,
    ...options,
  });

  return token;
};

export const getTestAuthenticationConfirmationToken = (
  options: Partial<JwtSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.authentication_service.issuer,
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
