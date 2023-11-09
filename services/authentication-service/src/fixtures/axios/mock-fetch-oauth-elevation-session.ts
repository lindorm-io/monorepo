import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdClientType,
  OpenIdDisplayMode,
  Scope,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { GetElevationSessionResponse } from "@lindorm-io/common-types";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";

export const mockFetchOauthElevationSession = (
  options: Partial<GetElevationSessionResponse> = {},
): GetElevationSessionResponse => ({
  elevation: {
    isRequired: true,
    status: SessionStatus.PENDING,

    factors: [AuthenticationFactor.ONE_FACTOR],
    levelOfAssurance: 2,
    methods: [AuthenticationMethod.EMAIL],
    minimumLevelOfAssurance: 2,
    strategies: [AuthenticationStrategy.EMAIL_OTP],
  },

  elevationSession: {
    id: randomUUID(),
    authenticationHint: ["test@lindorm.io"],
    country: "se",
    displayMode: OpenIdDisplayMode.PAGE,
    expires: "2022-01-01T04:00:00.000Z",
    idTokenHint: null,
    identityId: randomUUID(),
    nonce: randomString(16),
    uiLocales: ["en-GB", "sv-SE"],
  },

  browserSession: {
    id: randomUUID(),
    adjustedAccessLevel: 2,
    factors: [AuthenticationFactor.TWO_FACTOR],
    identityId: randomUUID(),
    latestAuthentication: "2021-01-01T07:59:00.000Z",
    levelOfAssurance: 2,
    methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    remember: true,
    singleSignOn: true,
    strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
  },

  clientSession: {
    id: randomUUID(),
    adjustedAccessLevel: 2,
    audiences: [randomUUID()],
    factors: [AuthenticationFactor.TWO_FACTOR],
    identityId: randomUUID(),
    latestAuthentication: "2021-01-01T07:59:00.000Z",
    levelOfAssurance: 2,
    methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    scopes: [Scope.OPENID, Scope.PROFILE],
    strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
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
