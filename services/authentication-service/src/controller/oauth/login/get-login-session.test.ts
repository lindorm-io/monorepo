import { OpenIdClientType } from "@lindorm-io/common-types";
import { mockFetchOauthAuthorizationRequest } from "../../../fixtures/axios";
import { getOauthAuthorizationRequest as _fetchOauthAuthorizationRequest } from "../../../handler";
import { getLoginSessionController } from "./get-login-session";

jest.mock("../../../handler");

const fetchOauthAuthorizationRequest = _fetchOauthAuthorizationRequest as jest.Mock;

describe("getLoginSessionDataController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { id: "id" },
    };

    fetchOauthAuthorizationRequest.mockResolvedValue(mockFetchOauthAuthorizationRequest());
  });

  test("should resolve", async () => {
    await expect(getLoginSessionController(ctx)).resolves.toStrictEqual({
      body: {
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
