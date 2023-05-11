import { getConsentSessionController } from "./get-consent-session";
import { getOauthAuthorizationSession as _fetchOauthAuthorizationSession } from "../../../handler";
import { mockFetchOauthAuthorizationSession } from "../../../fixtures/axios";
import { OpenIdClientType } from "@lindorm-io/common-types";

jest.mock("../../../handler");

const fetchOauthAuthorizationSession = _fetchOauthAuthorizationSession as jest.Mock;

describe("getConsentSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { id: "id" },
    };

    fetchOauthAuthorizationSession.mockResolvedValue(mockFetchOauthAuthorizationSession());
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
