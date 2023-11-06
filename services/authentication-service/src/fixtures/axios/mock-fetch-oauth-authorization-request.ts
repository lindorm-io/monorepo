import {
  AuthenticationMethod,
  AuthenticationStrategy,
  GetAuthorizationResponse,
  LindormScope,
  OpenIdClientType,
  OpenIdDisplayMode,
  OpenIdPromptMode,
  OpenIdScope,
  SessionStatus,
} from "@lindorm-io/common-types";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";

export const mockFetchOauthAuthorizationSession = (
  options: Partial<GetAuthorizationResponse> = {},
): GetAuthorizationResponse => ({
  consent: {
    isRequired: true,
    status: SessionStatus.PENDING,

    audiences: [randomUUID()],
    optionalScopes: Object.values(LindormScope),
    requiredScopes: Object.values(OpenIdScope),
    scopeDescriptions: [],
  },

  login: {
    isRequired: true,
    status: SessionStatus.PENDING,

    identityId: randomUUID(),
    minimumLevel: 2,
    recommendedLevel: 2,
    recommendedMethods: [AuthenticationMethod.EMAIL],
    recommendedStrategies: [AuthenticationStrategy.EMAIL_CODE],
    requiredLevel: 2,
    requiredMethods: [AuthenticationMethod.EMAIL],
    requiredStrategies: [AuthenticationStrategy.EMAIL_OTP],
  },

  selectAccount: {
    isRequired: true,
    status: SessionStatus.PENDING,

    sessions: [
      { selectId: randomUUID(), identityId: randomUUID() },
      { selectId: randomUUID(), identityId: randomUUID() },
    ],
  },

  authorizationSession: {
    id: randomUUID(),
    country: "se",
    displayMode: OpenIdDisplayMode.PAGE,
    expires: "2022-01-01T04:00:00.000Z",
    idTokenHint: "id.jwt.jwt",
    loginHint: ["test@lindorm.io"],
    maxAge: 500,
    nonce: randomString(16),
    originalUri: "https://oauth.lindorm.io/oauth2/authorize?query=query",
    promptModes: [
      OpenIdPromptMode.CONSENT,
      OpenIdPromptMode.LOGIN,
      OpenIdPromptMode.SELECT_ACCOUNT,
    ],
    redirectUri: "https://test.client.com/redirect",
    uiLocales: ["en-GB", "sv-SE"],
  },

  browserSession: {
    id: randomUUID(),
    adjustedAccessLevel: 3,
    identityId: randomUUID(),
    latestAuthentication: new Date().toISOString(),
    levelOfAssurance: 2,
    methods: [AuthenticationMethod.EMAIL],
    remember: true,
    singleSignOn: true,
  },

  clientSession: {
    id: randomUUID(),
    adjustedAccessLevel: 3,
    audiences: [randomUUID()],
    identityId: randomUUID(),
    latestAuthentication: new Date().toISOString(),
    levelOfAssurance: 2,
    methods: [AuthenticationMethod.EMAIL],
    scopes: Object.values(OpenIdScope),
  },

  client: {
    id: randomUUID(),
    logoUri: "https://test.client.com/logo.png",
    name: "Test Client",
    type: OpenIdClientType.PUBLIC,
    singleSignOn: true,
  },

  tenant: {
    id: randomUUID(),
    name: "Test Tenant",
  },

  ...options,
});
