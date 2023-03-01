import { getLoginSessionController } from "./get-login-session";
import { getOauthAuthorizationSession as _fetchOauthAuthorizationSession } from "../../../handler";
import { mockFetchOauthAuthorizationSession } from "../../../fixtures/axios";

jest.mock("../../../handler");

const fetchOauthAuthorizationSession = _fetchOauthAuthorizationSession as jest.Mock;

describe("getLoginSessionDataController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { id: "id" },
    };

    fetchOauthAuthorizationSession.mockResolvedValue(mockFetchOauthAuthorizationSession());
  });

  test("should resolve", async () => {
    await expect(getLoginSessionController(ctx)).resolves.toStrictEqual({
      body: {
        client: {
          logoUri: "https://test.client.com/logo.png",
          name: "Test Client",
          tenant: "Test Tenant",
          type: "public",
        },
        status: "pending",
      },
    });
  });
});
