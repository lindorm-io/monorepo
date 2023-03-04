import { getLogoutSessionController } from "./get-logout-session";
import { getOauthLogoutSession as _fetchOauthLogoutSession } from "../../../handler";
import { mockFetchOauthLogoutSession } from "../../../fixtures/axios";

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
        client: {
          logoUri: "https://test.client.com/logo.png",
          name: "Test Client",
          tenant: "Test Tenant",
          type: "public",
        },
        clientSession: {
          id: expect.any(String),
        },
        status: "pending",
      },
    });
  });
});
