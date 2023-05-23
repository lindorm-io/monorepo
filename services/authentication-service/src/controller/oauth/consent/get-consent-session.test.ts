import { OpenIdClientType } from "@lindorm-io/common-types";
import { mockFetchOauthAuthorizationRequest } from "../../../fixtures/axios";
import { getOauthAuthorizationRequest as _fetchOauthAuthorizationRequest } from "../../../handler";
import { getConsentSessionController } from "./get-consent-session";

jest.mock("../../../handler");

const fetchOauthAuthorizationRequest = _fetchOauthAuthorizationRequest as jest.Mock;

describe("getConsentSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { id: "id" },
    };

    fetchOauthAuthorizationRequest.mockResolvedValue(mockFetchOauthAuthorizationRequest());
  });

  test("should resolve", async () => {
    await expect(getConsentSessionController(ctx)).resolves.toStrictEqual({
      body: {
        audiences: [expect.any(String)],
        optionalScopes: [
          "accessibility",
          "national_identity_number",
          "public",
          "social_security_number",
          "username",
        ],
        requiredScopes: ["address", "email", "offline_access", "openid", "phone", "profile"],
        scopeDescriptions: [],
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
