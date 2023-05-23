import {
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdDisplayMode,
  OpenIdPromptMode,
  OpenIdResponseMode,
  OpenIdResponseType,
  OpenIdScope,
  PKCEMethod,
} from "@lindorm-io/common-types";
import { baseHash } from "@lindorm-io/core";
import { randomUnreserved } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { AuthorizationRequest, AuthorizationRequestOptions } from "../../entity";

export const createTestAuthorizationRequest = (
  options: Partial<AuthorizationRequestOptions> = {},
): AuthorizationRequest =>
  new AuthorizationRequest({
    code: {
      codeChallenge: randomUnreserved(43),
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
      recommendedStrategies: [AuthenticationStrategy.EMAIL_CODE],
      requiredLevel: 3,
      requiredMethods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      requiredStrategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
      ...(options.requestedLogin || {}),
    },
    requestedSelectAccount: {
      browserSessions: [{ browserSessionId: randomUUID(), identityId: randomUUID() }],
      ...(options.requestedSelectAccount || {}),
    },

    browserSessionId: randomUUID(),
    clientId: randomUUID(),
    clientSessionId: randomUUID(),
    country: "se",
    displayMode: OpenIdDisplayMode.POPUP,
    expires: new Date("2021-01-02T08:00:00.000Z"),
    idTokenHint: "id.jwt.jwt",
    loginHint: ["test@lindorm.io"],
    maxAge: 999,
    nonce: randomUnreserved(16),
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
    responseMode: OpenIdResponseMode.QUERY,
    responseTypes: [OpenIdResponseType.CODE, OpenIdResponseType.ID_TOKEN, OpenIdResponseType.TOKEN],
    state: randomUnreserved(16),
    uiLocales: ["sv-SE", "en-GB"],

    ...options,
  });
