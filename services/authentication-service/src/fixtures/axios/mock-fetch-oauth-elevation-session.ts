import { randomUUID } from "crypto";
import { randomString } from "@lindorm-io/random";
import {
  AuthenticationMethod,
  GetElevationResponse,
  OpenIdClientType,
  OpenIdDisplayMode,
  SessionStatus,
} from "@lindorm-io/common-types";

export const mockFetchOauthElevationSession = (
  options: Partial<GetElevationResponse> = {},
): GetElevationResponse => ({
  elevation: {
    isRequired: true,
    status: SessionStatus.PENDING,

    minimumLevel: 2,
    recommendedLevel: 2,
    recommendedMethods: [AuthenticationMethod.EMAIL],
    requiredLevel: 2,
    requiredMethods: [AuthenticationMethod.EMAIL],
  },

  client: {
    logoUri: "https://test.client.com/logo.png",
    name: "Test Client",
    tenant: "Test Tenant",
    type: OpenIdClientType.PUBLIC,
  },

  elevationSession: {
    authenticationHint: ["test@lindorm.io"],
    country: "se",
    displayMode: OpenIdDisplayMode.PAGE,
    expires: "2022-01-01T04:00:00.000Z",
    idTokenHint: "id.jwt.jwt",
    identityId: randomUUID(),
    nonce: randomString(16),
    uiLocales: ["en-GB", "sv-SE"],
  },

  ...options,
});
