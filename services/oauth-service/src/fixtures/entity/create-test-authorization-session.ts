import { AuthorizationSession, AuthorizationSessionOptions } from "../../entity";
import { baseHash, PKCEMethod } from "@lindorm-io/core";
import {
  DisplayMode,
  PromptMode,
  ResponseMode,
  ResponseType,
  Scope,
  SessionStatus,
} from "../../common";

export const createTestAuthorizationSession = (
  options: Partial<AuthorizationSessionOptions> = {},
): AuthorizationSession =>
  new AuthorizationSession({
    audiences: ["1f7e85f9-d707-4319-8b7e-c3c6a2bf8312"],
    authToken: "auth.jwt.jwt",
    authenticationMethods: ["email_otp", "phone_otp"],
    authenticationStatus: SessionStatus.PENDING,
    browserSessionId: "c284c06a-29fe-4a3d-ace3-52aacc4f4588",
    clientId: "1f7e85f9-d707-4319-8b7e-c3c6a2bf8312",
    code: "vDQr4zWZxFpINepNGVialEo7yMnEoyJKcEDeMmtS0kHJ08nBqaLaljulOmjzmhhYvDQr4zWZxFpINepNGVialEo7yMnEoyJKcEDeMmtS0kHJ08nBqaLaljulOmjzmhhY",
    codeChallenge: "y6HJCdnyw1CdL9qHAKy9GXKh0328UTiO",
    codeChallengeMethod: PKCEMethod.S256,
    consentSessionId: "4ce0134a-06fc-463a-a1ed-80ea33034b70",
    consentStatus: SessionStatus.PENDING,
    country: "se",
    displayMode: DisplayMode.POPUP,
    expires: new Date("2021-01-02T08:00:00.000Z"),
    idTokenHint: "id.jwt.jwt",
    identityId: "3f6ee784-bf36-4570-b15e-883dad02ec56",
    levelOfAssurance: 2,
    loginHint: ["test@lindorm.io"],
    maxAge: 999,
    nonce: "xkBpdx5HF1T0fiJL",
    originalUri: "https://localhost/oauth2/authorize?query=query",
    promptModes: [PromptMode.LOGIN, PromptMode.CONSENT],
    redirectData: baseHash(
      baseHash(JSON.stringify({ string: "string", number: 123, boolean: true })),
    ),
    redirectUri: "https://test.client.lindorm.io/redirect",
    responseMode: ResponseMode.QUERY,
    responseTypes: [ResponseType.CODE, ResponseType.ID_TOKEN, ResponseType.TOKEN],
    scopes: [
      Scope.ADDRESS,
      Scope.EMAIL,
      Scope.OFFLINE_ACCESS,
      Scope.OPENID,
      Scope.PHONE,
      Scope.PROFILE,
    ],
    state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    uiLocales: ["sv-SE", "en-GB"],
    ...options,
  });
