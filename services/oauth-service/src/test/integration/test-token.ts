import { TokenType } from "../../enum";
import { configuration } from "../../server/configuration";
import { createTestJwt, IssuerSignOptions } from "@lindorm-io/jwt";
import {
  IdentityServiceClaims,
  ClientPermission,
  ClientScope,
  IdentityPermission,
  Scope,
  SubjectHint,
} from "../../common";

export const getTestAccessToken = (options: Partial<IssuerSignOptions<any, any>> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: ["3c12edf7-2e1d-4df2-a199-3226e36f84a4"],
    authContextClass: ["loa_2", "email_otp", "phone_otp"],
    authMethodsReference: ["email_otp", "phone_otp"],
    expiry: "10 seconds",
    levelOfAssurance: 2,
    permissions: Object.values(IdentityPermission),
    scopes: Object.values(Scope),
    sessionId: "4e8cbd69-f474-43df-a195-ecfe35d78522",
    subject: "7914aeb7-76bc-4341-8b1e-8392528b6fac",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ACCESS,
    ...options,
  });

  return token;
};

export const getTestClientCredentials = (
  options: Partial<IssuerSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: ["08e99132-09d5-4f87-a489-a62d2896a7bf"],
    expiry: "10 seconds",
    permissions: Object.values(ClientPermission),
    scopes: Object.values(ClientScope),
    subject: "08e99132-09d5-4f87-a489-a62d2896a7bf",
    subjectHint: SubjectHint.CLIENT,
    type: TokenType.ACCESS,
    ...options,
  });

  return token;
};

export const getTestIdToken = (
  options: Partial<IssuerSignOptions<any, Partial<IdentityServiceClaims>>> = {},
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

export const getTestRefreshToken = (options: Partial<IssuerSignOptions<any, any>> = {}): string => {
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
