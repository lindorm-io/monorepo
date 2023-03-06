import { getLoginSessionController } from "./get-login-session";
import { getOauthAuthorizationSession as _fetchOauthAuthorizationSession } from "../../../handler";
import { mockFetchOauthAuthorizationSession } from "../../../fixtures/axios";
import { OpenIdClientType } from "@lindorm-io/common-types";

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
        status: "pending",
        client: {
          id: expect.any(String),
          logoUri: "https://test.client.com/logo.png",
          name: "Test Client",
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
