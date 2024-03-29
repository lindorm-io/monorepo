import { OpenIdClientType } from "@lindorm-io/common-enums";
import { mockFetchOauthLogoutSession } from "../../../fixtures/axios";
import { getOauthLogoutSession as _fetchOauthLogoutSession } from "../../../handler";
import { getLogoutSessionController } from "./get-logout-session";

jest.mock("../../../handler");

const fetchOauthLogoutSession = _fetchOauthLogoutSession as jest.Mock;

describe("getLogoutSessionDataController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { id: "id" },
    };

    fetchOauthLogoutSession.mockResolvedValue(mockFetchOauthLogoutSession());
  });

  test("should resolve", async () => {
    await expect(getLogoutSessionController(ctx)).resolves.toStrictEqual({
      body: {
        browserSession: {
          connectedSessions: 3,
          id: expect.any(String),
        },
        clientSession: {
          id: expect.any(String),
        },
        status: "pending",
        client: {
          id: expect.any(String),
          logoUri: "https://test.client.com/logo.png",
          name: "Test Client",
          singleSignOn: true,
          type: OpenIdClientType.PUBLIC,
        },
        tenant: {
          id: expect.any(String),
          name: "Test Tenant",
        },
      },
    });
  });
});
