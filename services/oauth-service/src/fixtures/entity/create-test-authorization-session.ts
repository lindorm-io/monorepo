import { AuthorizationSession, AuthorizationSessionOptions } from "../../entity";
import { baseHash, PKCEMethod, randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import {
  AuthenticationMethod,
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
    code: {
      codeChallenge: randomString(64),
      codeChallengeMethod: PKCEMethod.S256,
    },
    requestedConsent: {
      audiences: [randomUUID()],
      scopes: [
        Scope.ADDRESS,
        Scope.EMAIL,
        Scope.OFFLINE_ACCESS,
        Scope.OPENID,
        Scope.PHONE,
        Scope.PROFILE,
      ],
    },
    requestedLogin: {
      authenticationMethods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      identityId: randomUUID(),
      levelHint: 2,
      levelOfAssurance: 3,
      methodHint: [AuthenticationMethod.EMAIL],
    },
    status: {
      login: SessionStatus.PENDING,
      consent: SessionStatus.PENDING,
    },

    authToken: "auth.jwt.jwt",
    clientId: randomUUID(),
    country: "se",
    displayMode: DisplayMode.POPUP,
    expires: new Date("2021-01-02T08:00:00.000Z"),
    idTokenHint: "id.jwt.jwt",
    loginHint: ["test@lindorm.io"],
    maxAge: 999,
    nonce: randomString(16),
    originalUri: "https://localhost/oauth2/authorize?query=query",
    promptModes: [PromptMode.LOGIN, PromptMode.CONSENT],
    redirectData: baseHash(
      baseHash(JSON.stringify({ string: "string", number: 123, boolean: true })),
    ),
    redirectUri: "https://test.client.lindorm.io/redirect",
    responseMode: ResponseMode.QUERY,
    responseTypes: [ResponseType.CODE, ResponseType.ID_TOKEN, ResponseType.TOKEN],
    state: randomString(16),
    uiLocales: ["sv-SE", "en-GB"],
    ...options,
  });
