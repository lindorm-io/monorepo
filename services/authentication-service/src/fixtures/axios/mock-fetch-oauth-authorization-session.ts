import { randomUUID } from "crypto";
import { randomString } from "@lindorm-io/random";
import {
  AuthenticationMethod,
  GetAuthorizationResponse,
  LindormScope,
  OpenIdClientType,
  OpenIdDisplayMode,
  OpenIdPromptMode,
  OpenIdScope,
  SessionStatus,
} from "@lindorm-io/common-types";

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
    requiredLevel: 2,
    requiredMethods: [AuthenticationMethod.EMAIL],
  },

  selectAccount: {
    isRequired: true,
    status: SessionStatus.PENDING,

    sessions: [{ selectId: randomUUID(), identityId: randomUUID() }],
  },

  accessSession: {
    adjustedAccessLevel: 3,
    audiences: [randomUUID()],
    identityId: randomUUID(),
    latestAuthentication: new Date(),
    levelOfAssurance: 2,
    methods: [AuthenticationMethod.EMAIL],
    scopes: Object.values(OpenIdScope),
  },

  authorizationSession: {
    authToken: null,
    country: "se",
    displayMode: OpenIdDisplayMode.PAGE,
    expiresAt: "2022-01-01T04:00:00.000Z",
    expiresIn: 1800,
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
    adjustedAccessLevel: 3,
    identityId: randomUUID(),
    latestAuthentication: new Date(),
    levelOfAssurance: 2,
    methods: [AuthenticationMethod.EMAIL],
    remember: true,
    sso: true,
  },

  client: {
    logoUri: "https://test.client.com/logo.png",
    name: "Test Client",
    tenant: "Test Tenant",
    type: OpenIdClientType.PUBLIC,
  },

  refreshSession: {
    adjustedAccessLevel: 3,
    audiences: [randomUUID()],
    identityId: randomUUID(),
    latestAuthentication: new Date(),
    levelOfAssurance: 2,
    methods: [AuthenticationMethod.EMAIL],
    scopes: Object.values(OpenIdScope),
  },

  ...options,
});
