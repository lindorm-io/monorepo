import {
  AuthenticationMethod,
  GetElevationSessionResponse,
  OpenIdClientType,
  OpenIdDisplayMode,
  SessionStatus,
} from "@lindorm-io/common-types";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";

export const mockFetchOauthElevationSession = (
  options: Partial<GetElevationSessionResponse> = {},
): GetElevationSessionResponse => ({
  elevation: {
    isRequired: true,
    status: SessionStatus.PENDING,

    minimumLevel: 2,
    recommendedLevel: 2,
    recommendedMethods: [AuthenticationMethod.EMAIL],
    requiredLevel: 2,
    requiredMethods: [AuthenticationMethod.EMAIL],
  },

  elevationSession: {
    id: randomUUID(),
    authenticationHint: ["test@lindorm.io"],
    country: "se",
    displayMode: OpenIdDisplayMode.PAGE,
    expires: "2022-01-01T04:00:00.000Z",
    idTokenHint: "id.jwt.jwt",
    identityId: randomUUID(),
    nonce: randomString(16),
    uiLocales: ["en-GB", "sv-SE"],
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
