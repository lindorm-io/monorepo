import { OpenIdClientType, SessionStatus } from "@lindorm-io/common-enums";
import { GetLogoutResponse } from "@lindorm-io/common-types";
import { randomUUID } from "crypto";

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

  logoutSession: {
    id: randomUUID(),
    expires: "2022-01-01T04:00:00.000Z",
    idTokenHint: null,
    identityId: randomUUID(),
    logoutHint: "test@lindorm.io",
    originalUri: "https://oauth.lindorm.io/oauth2/logout?query=query",
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
