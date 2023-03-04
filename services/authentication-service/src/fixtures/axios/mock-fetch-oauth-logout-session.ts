import { randomUUID } from "crypto";
import { GetLogoutResponse, OpenIdClientType, SessionStatus } from "@lindorm-io/common-types";

export const mockFetchOauthLogoutSession = (
  options: Partial<GetLogoutResponse> = {},
): GetLogoutResponse => ({
  logout: {
    status: SessionStatus.PENDING,

    browserSession: {
      id: randomUUID(),
      connectedSessions: 3,
    },
    clientSession: {
      id: randomUUID(),
    },
  },

  client: {
    logoUri: "https://test.client.com/logo.png",
    name: "Test Client",
    tenant: "Test Tenant",
    type: OpenIdClientType.PUBLIC,
  },

  logoutSession: {
    expires: "2022-01-01T04:00:00.000Z",
    idTokenHint: "id.jwt.jwt",
    identityId: randomUUID(),
    logoutHint: "test@lindorm.io",
    originalUri: "https://oauth.lindorm.io/oauth2/logout?query=query",
    uiLocales: ["en-GB", "sv-SE"],
  },

  ...options,
});
