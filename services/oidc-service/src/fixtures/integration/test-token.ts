import { createTestJwt, JwtSignOptions } from "@lindorm-io/jwt";
import { configuration } from "../../server/configuration";
import {
  ClientPermission,
  ClientScope,
  IdentityPermission,
  Scope,
  SubjectHint,
} from "../../common";

export const getTestAccessToken = (options: Partial<JwtSignOptions<any, any>> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.oauth_service.issuer,
  }).sign({
    audiences: ["08e99132-09d5-4f87-a489-a62d2896a7bf"],
    authContextClass: ["loa_2", "email_otp", "phone_otp"],
    authMethodsReference: ["email_otp", "phone_otp"],
    expiry: "10 seconds",
    levelOfAssurance: 2,
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
    sessionId: "4e8cbd69-f474-43df-a195-ecfe35d78522",
    subject: "7914aeb7-76bc-4341-8b1e-8392528b6fac",
    subjectHint: SubjectHint.IDENTITY,
    type: "access_token",
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
    permissions: [ClientPermission.OIDC_CONFIDENTIAL, ClientPermission.OIDC_PUBLIC],
    scopes: [ClientScope.OIDC_SESSION_WRITE, ClientScope.OIDC_SESSION_READ],
    subject: "08e99132-09d5-4f87-a489-a62d2896a7bf",
    subjectHint: "client",
    type: "access_token",
    ...options,
  });
  return token;
};

export const getTestGoogleIdToken = (options: Partial<JwtSignOptions<any, any>> = {}): string => {
  const { token } = createTestJwt({
    issuer: "https://jwt.google.com",
  }).sign({
    audiences: ["google_client_id"],
    claims: {
      given_name: "given",
    },
    expiry: "10 seconds",
    nonce: options.nonce,
    subject: "aee67d8d-62a1-4361-914a-15527342ac4e",
    subjectHint: "identity",
    type: "access_token",
  });
  return token;
};
