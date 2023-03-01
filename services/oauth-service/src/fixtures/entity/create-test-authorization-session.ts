import { AuthorizationSession, AuthorizationSessionOptions } from "../../entity";
import { baseHash } from "@lindorm-io/core";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import {
  AuthenticationMethod,
  OpenIdDisplayMode,
  OpenIdPromptMode,
  OpenIdResponseMode,
  OpenIdResponseType,
  OpenIdScope,
  PKCEMethod,
} from "@lindorm-io/common-types";

export const createTestAuthorizationSession = (
  options: Partial<AuthorizationSessionOptions> = {},
): AuthorizationSession =>
  new AuthorizationSession({
    code: {
      codeChallenge: randomString(64),
      codeChallengeMethod: PKCEMethod.SHA256,
      ...(options.code || {}),
    },
    requestedConsent: {
      audiences: [randomUUID()],
      scopes: [
        OpenIdScope.ADDRESS,
        OpenIdScope.EMAIL,
        OpenIdScope.OFFLINE_ACCESS,
        OpenIdScope.OPENID,
        OpenIdScope.PHONE,
        OpenIdScope.PROFILE,
      ],
      ...(options.requestedConsent || {}),
    },
    requestedLogin: {
      identityId: randomUUID(),
      minimumLevel: 2,
      recommendedLevel: 2,
      recommendedMethods: [AuthenticationMethod.EMAIL],
      requiredLevel: 3,
      requiredMethods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      ...(options.requestedLogin || {}),
    },
    requestedSelectAccount: {
      browserSessions: [{ browserSessionId: randomUUID(), identityId: randomUUID() }],
      ...(options.requestedSelectAccount || {}),
    },

    accessSessionId: randomUUID(),
    authToken: "auth.jwt.jwt",
    browserSessionId: randomUUID(),
    clientId: randomUUID(),
    country: "se",
    displayMode: OpenIdDisplayMode.POPUP,
    expires: new Date("2021-01-02T08:00:00.000Z"),
    idTokenHint: "id.jwt.jwt",
    loginHint: ["test@lindorm.io"],
    maxAge: 999,
    nonce: randomString(16),
    originalUri: "https://localhost/oauth2/authorize?query=query",
    promptModes: [
      OpenIdPromptMode.LOGIN,
      OpenIdPromptMode.CONSENT,
      OpenIdPromptMode.SELECT_ACCOUNT,
    ],
    redirectData: baseHash(
      baseHash(JSON.stringify({ string: "string", number: 123, boolean: true })),
    ),
    redirectUri: "https://test.client.lindorm.io/redirect",
    refreshSessionId: randomUUID(),
    responseMode: OpenIdResponseMode.QUERY,
    responseTypes: [OpenIdResponseType.CODE, OpenIdResponseType.ID_TOKEN, OpenIdResponseType.TOKEN],
    state: randomString(16),
    uiLocales: ["sv-SE", "en-GB"],

    ...options,
  });
