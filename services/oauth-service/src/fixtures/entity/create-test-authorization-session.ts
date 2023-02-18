import { AuthorizationSession, AuthorizationSessionOptions } from "../../entity";
import { baseHash } from "@lindorm-io/core";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import {
  AuthenticationMethods,
  LindormScopes,
  OauthDisplayModes,
  OauthPromptModes,
  OauthResponseModes,
  OauthResponseTypes,
} from "@lindorm-io/common-types";

export const createTestAuthorizationSession = (
  options: Partial<AuthorizationSessionOptions> = {},
): AuthorizationSession =>
  new AuthorizationSession({
    code: {
      codeChallenge: randomString(64),
      codeChallengeMethod: "S256",
      ...(options.code || {}),
    },
    requestedConsent: {
      audiences: [randomUUID()],
      scopes: [
        LindormScopes.ADDRESS,
        LindormScopes.EMAIL,
        LindormScopes.OFFLINE_ACCESS,
        LindormScopes.OPENID,
        LindormScopes.PHONE,
        LindormScopes.PROFILE,
      ],
      ...(options.requestedConsent || {}),
    },
    requestedLogin: {
      identityId: randomUUID(),
      minimumLevel: 2,
      recommendedLevel: 2,
      recommendedMethods: [AuthenticationMethods.EMAIL],
      requiredLevel: 3,
      requiredMethods: [AuthenticationMethods.EMAIL, AuthenticationMethods.PHONE],
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
    displayMode: OauthDisplayModes.POPUP,
    expires: new Date("2021-01-02T08:00:00.000Z"),
    idTokenHint: "id.jwt.jwt",
    loginHint: ["test@lindorm.io"],
    maxAge: 999,
    nonce: randomString(16),
    originalUri: "https://localhost/oauth2/authorize?query=query",
    promptModes: [
      OauthPromptModes.LOGIN,
      OauthPromptModes.CONSENT,
      OauthPromptModes.SELECT_ACCOUNT,
    ],
    redirectData: baseHash(
      baseHash(JSON.stringify({ string: "string", number: 123, boolean: true })),
    ),
    redirectUri: "https://test.client.lindorm.io/redirect",
    refreshSessionId: randomUUID(),
    responseMode: OauthResponseModes.QUERY,
    responseTypes: [OauthResponseTypes.CODE, OauthResponseTypes.ID_TOKEN, OauthResponseTypes.TOKEN],
    state: randomString(16),
    uiLocales: ["sv-SE", "en-GB"],

    ...options,
  });
